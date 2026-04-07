import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  
  try {
    const res = await client.query("UPDATE auth.users SET last_sign_in_at = now() WHERE email = 'vendaprofit.app@gmail.com' RETURNING *");
    console.log("Success updating as postgres:", res.rows.length);
  } catch (err) {
    console.error("Error asking postgres:", err.message);
  }
  
  await client.end();
}

run().catch(console.error);
