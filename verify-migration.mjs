import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:zNftfq4hPR3l00vW@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log("Conectado ao banco de dados!");

    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public'
    `);

    console.log(`Encontradas ${tablesRes.rowCount} tabelas. Verificando dados...`);
    
    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      const countRes = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
      console.log(`Tabela: ${tableName} - Registros: ${countRes.rows[0].count}`);
    }

  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await client.end();
  }
}

run();
