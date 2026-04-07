import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT policyname, qual, with_check FROM pg_policies WHERE tablename = 'profiles'");
  console.dir(res.rows, { depth: null });
  await client.end();
}

run().catch(console.error);
