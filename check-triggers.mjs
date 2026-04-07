import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const q = `
    SELECT tgname, pg_get_triggerdef(oid) as def 
    FROM pg_trigger 
    WHERE tgrelid = 'auth.users'::regclass
  `;
  const { rows } = await client.query(q);
  console.log("Triggers:", rows);
  await client.end();
}

run().catch(console.error);
