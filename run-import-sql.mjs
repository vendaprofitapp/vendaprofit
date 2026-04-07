import { Client } from 'pg';
import fs from 'fs';

const sqlPath = 'C:\\Users\\Team WOD Brasil\\Desktop\\vendaprofit-antigravity\\vendaprofit\\data_import.sql';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const rawSql = fs.readFileSync(sqlPath, 'utf8');
    
    // Extraindo comandos para garantir que não mande tudo de uma vez por limitação de memória do buffer
    console.log("Conectando ao banco de dados Supabase...");
    await client.connect();
    
    console.log("Banco de Dados Conectado! Iniciando injeção em lote...");
    
    // O arquivo já é um compilado que tem statements separados por \n\n ou comandos gigantescos.
    // Vamos particionar por "INSERT INTO"
    const chunks = rawSql.split(/;\n\n/g);
    let success = 0;
    
    // A configuração de ROLE não vem nos blocos normais se o split quebrar elas.
    await client.query("SET session_replication_role = replica;");

    for (let i = 0; i < chunks.length; i++) {
        const query = chunks[i].trim();
        if (!query) continue;
        
        try {
            await client.query(query);
            success++;
            if (success % 10 === 0) console.log(`Progresso: Injetado lote ${success} de ${chunks.length}`);
        } catch(e) {
            console.error(`\nErro na query nº ${i}:`, e.message);
            console.error(query.substring(0, 150) + "...");
        }
    }

    await client.query("SET session_replication_role = DEFAULT;");
    console.log(`\nImportação total finalizada. Blocos executados: ${success}`);

  } catch (error) {
    console.error("Erro ao conectar ou ler arquivo:", error);
  } finally {
    await client.end();
  }
}

run();
