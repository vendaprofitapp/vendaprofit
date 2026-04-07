import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  
  // Set the role to supabase_auth_admin
  await client.query("SET ROLE supabase_auth_admin");
  
  // Try querying public as supabase_auth_admin user
  try {
    const res = await client.query("UPDATE auth.users SET last_sign_in_at = now() WHERE email = 'vendaprofit.app@gmail.com' RETURNING *");
    console.log("Success updating as supabase_auth_admin:", res.rows.length);
  } catch (err) {
    console.error("Error asking postgres as supabase_auth_admin:", err.message);
  }
  
  await client.end();
}

run().catch(console.error);
