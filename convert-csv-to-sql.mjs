import fs from 'fs';
import Papa from 'papaparse';

const csvFilePath = 'C:\\Users\\Team WOD Brasil\\Downloads\\backup_vendaprofit_full.csv';
const outputDir = 'C:\\Users\\Team WOD Brasil\\Desktop\\vendaprofit-antigravity\\vendaprofit\\sql_chunks';
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);


// Ordenação correta de tabelas do Lovable baseada em Foreign Keys (evitando falhas caso role de replicação não funcione 100%)
const tableOrderPriority = [
  'profiles', 'users', 'main_categories', 'subcategories', 'customers',
  'store_settings', 'products', 'product_variants', 'sales', 'cart_items',
  'store_leads', 'lead_cart_items', 'groups', 'group_members', 'financial_splits',
  'product_partnerships', 'marketing_channels', 'campaigns', 'marketing_costs',
  'marketing_messages', 'marketing_content', 'marketing_tasks', 'partner_requests',
  'supplier_prices', 'bazar_items', 'customer_bazar_permissions', 'user_subscriptions'
].reverse(); // Reverse allows sorting priority natively later.

// Função wrapper para ordernar tabelas lidas
function getTablePriority(tableName) {
   const idx = tableOrderPriority.indexOf(tableName);
   return idx !== -1 ? idx : -1;
}

async function convert() {
  console.log("Lendo arquivo CSV inteiro (20MB) para memória...");
  const csvText = fs.readFileSync(csvFilePath, 'utf8');

  console.log("Dividindo por tabelas...");
  // Lovable dump pattern is `=== TABLE: tablename ===`
  const tableChunks = csvText.split(/=== TABLE: (.*) ===/g);

  // array vai ser: [0: "lixoAntes", 1: "tablename", 2: "\nheader\ndata", 3: "tablename2", 4: "\nheader\ndata" ...]

  const parsedTables = [];
  
  for(let i = 1; i < tableChunks.length; i += 2) {
      const tableName = tableChunks[i].trim();
      const csvContent = tableChunks[i+1];
      
      if (!tableName || tableName.startsWith('_backup_')) {
          console.log(`Pulando tabela customizada/backup: ${tableName}`);
          continue;
      }
      
      const cleanCsv = csvContent.trim();
      if (!cleanCsv) continue;

      let headers = [];
      let rows = [];

      Papa.parse(cleanCsv, {
          header: true,
          skipEmptyLines: true,
          step: function(result) {
              if (!headers.length) headers = result.meta.fields;
              
              // Only insert valid rows with data
              if (Object.values(result.data).some(v => v !== "" && v !== undefined && v !== null)) {
                  rows.push(result.data);
              }
          }
      });

      if (rows.length > 0 && headers.length > 0) {
          parsedTables.push({
             name: tableName,
             headers: headers,
             rows: rows,
             priority: getTablePriority(tableName)
          });
      }
  }

  // Order by priority (from highest to -1)
  parsedTables.sort((a,b) => b.priority - a.priority);

  console.log(`\nEscrevendo SQL gerado com ${parsedTables.length} tabelas no formato nativo Insert Values em chunks...`);
  
  let totalImported = 0;
  let fileIndex = 1;
  let outStream = null;

  const getNewStream = () => {
     if (outStream) {
         outStream.write('SET session_replication_role = DEFAULT;\n');
         outStream.end();
     }
     const path = `${outputDir}/chunk_${String(fileIndex).padStart(3, '0')}.sql`;
     console.log(`Criando ${path}...`);
     outStream = fs.createWriteStream(path);
     outStream.write('SET session_replication_role = replica;\n\n');
     fileIndex++;
  };
  
  getNewStream();

  let bytesWritten = 0;
  const LIMIT = 1000 * 1000; // 1MB limit per file

  for (const table of parsedTables) {
      console.log(`+ Processando Tabela: ${table.name} (${table.rows.length} registros)`);
      totalImported += table.rows.length;

      // Safe quoting function
      const quoteString = (val, header) => {
          if (val === null || val === undefined) return 'NULL';
          if (val === '') {
              const h = header.toLowerCase();
              if (h === 'store_name' || h === 'name' || h === 'email' || h === 'title' || h.includes('phone') || h.includes('status') || h.includes('color')) {
                  return "''";
              }
              return 'NULL';
          }
          return "'" + String(val).replace(/'/g, "''") + "'";
      };
      
      const quoteCol = (col) => `"${col}"`;

      outStream.write(`-- Table: ${table.name}\n`);
      const cols = table.headers.map(quoteCol).join(', ');

      // Split in chunks of 100 rows to avoid giant query string errors
      const chunkSize = 100;
      for (let i = 0; i < table.rows.length; i+=chunkSize) {
          const chunk = table.rows.slice(i, i + chunkSize);
          
          let valuesStr = chunk.map(rowObj => {
             const vals = table.headers.map(h => quoteString(rowObj[h], h));
             return `(${vals.join(', ')})`;
          }).join(',\n  ');

          const insertStmt = `INSERT INTO public."${table.name}" (${cols}) VALUES\n  ${valuesStr}\n  ON CONFLICT DO NOTHING;\n\n`;
          outStream.write(insertStmt);
          bytesWritten += insertStmt.length;
          // Rotate if file is growing
          if (bytesWritten > LIMIT) {
              getNewStream();
              bytesWritten = 0;
          }
      }
  }

  if (outStream) {
      outStream.write('SET session_replication_role = DEFAULT;\n');
      outStream.end();
  }
  
  console.log(`=========================================\nConcluído! ${totalImported} linhas convertidas em ${fileIndex-1} arquivos SQL menores com sucesso.`);
}

convert().catch(console.error);
