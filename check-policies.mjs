import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname = 'public'");
  console.log("Policies:", res.rows);
  await client.end();
}

run().catch(console.error);
