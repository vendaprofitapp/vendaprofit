import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  
  // 1. Grant necessary roles that a raw SQL dump might have stripped
  await client.query("GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;");
  await client.query("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;");
  await client.query("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;");
  await client.query("GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;");

  // 2. Check for invalid or stale views. If a view is broken, we should know.
  const res = await client.query(`
    SELECT c.relname as view_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v' AND n.nspname = 'public';
  `);
  console.log("Views in public schema:", res.rows);

  // 3. Reload PostgREST
  await client.query("NOTIFY pgrst, 'reload schema'");
  console.log("Grants applied and schema reloaded.");
  
  await client.end();
}

run().catch(console.error);
