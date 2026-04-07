import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function test() {
  await client.connect();
  const res = await client.query("SELECT * FROM auth.users WHERE email = 'vendaprofit.app@gmail.com'");
  console.log("User:", res.rows[0]);
  const idRes = await client.query("SELECT * FROM auth.identities WHERE user_id = $1", [res.rows[0].id]);
  console.log("Identity:", idRes.rows[0]);
  await client.end();
}

test().catch(console.error);
