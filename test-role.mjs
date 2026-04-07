import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT has_role('92bc85ac-1b72-4b8f-b37e-481bc61913fa'::uuid, 'admin'::app_role)");
  console.log(res.rows);
  await client.end();
}

run().catch(console.error);
