import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT
      t.relname AS table_name,
      a.attname AS column_name,
      i.relname AS index_name
    FROM
      pg_class t,
      pg_class i,
      pg_index ix,
      pg_attribute a
    WHERE
      t.oid = ix.indrelid
      AND i.oid = ix.indexrelid
      AND a.attrelid = t.oid
      AND a.attnum = ANY(ix.indkey)
      AND t.relkind = 'r'
      AND t.relnamespace = 'public'::regnamespace;
  `);
  
  const fkRes = await client.query(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE constraint_type = 'FOREIGN KEY' AND tc.table_schema='public';
  `);

  const indexes = res.rows.map(r => r.table_name + '.' + r.column_name);
  const missing = fkRes.rows.filter(fk => !indexes.includes(fk.table_name + '.' + fk.column_name));
  
  console.log("Missing indexes on FKs:", missing.length);
  if(missing.length > 0) console.log(missing.slice(0, 10));

  await client.end();
}

run().catch(console.error);
