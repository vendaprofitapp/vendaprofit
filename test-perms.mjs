import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  
  // Set the role to authenticated to simulate API request
  await client.query("SET ROLE authenticated");
  
  // Try querying profiles as authenticated user
  try {
    const res = await client.query("SELECT * FROM profiles LIMIT 1");
    console.log("Success reading as authenticated:", res.rows.length);
  } catch (err) {
    console.error("Error asking postgres as authenticated:", err.message);
  }
  
  await client.end();
}

run().catch(console.error);
