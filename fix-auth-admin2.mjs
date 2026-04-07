import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  
  // Re-grant auth schema privileges to supabase_auth_admin
  await client.query("GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;");
  await client.query("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;");
  await client.query("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;");
  await client.query("GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin;");

  console.log("Grants applied to supabase_auth_admin in auth schema.");
  
  await client.end();
}

run().catch(console.error);
