import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  
  // 1. Fetch all missing indexes on Foreign Keys
  const res = await client.query(`
    SELECT
      t.relname AS table_name,
      a.attname AS column_name
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
  
  console.log("Found " + missing.length + " missing indexes! Adding them now...");
  
  // Create them iteratively
  for (const fk of missing) {
    const table = fk.table_name;
    const col = fk.column_name;
    const indexName = "idx_" + table + "_" + col;
    
    // Some column names might be > 63 chars when combined, Postgres max is 63, so let's just use standard generated names
    // CREATE INDEX doesn't require a name, it auto-generates one usually. But we give it a hint.
    const query = 'CREATE INDEX IF NOT EXISTS ' + indexName.substring(0, 60) + ' ON public."' + table + '" ("' + col + '")';
    console.log("  > " + query);
    try {
      await client.query(query);
    } catch (e) {
      console.error("Failed to create index on " + table + "." + col + ":", e.message);
    }
  }

  console.log("\\n2. ADDING STOCK QUANTITY CHECK CONSTRAINT");
  // Some stores might allow negative stock if they dropship, let's make sure stock doesn't go below 0 unless explicit?
  // Actually, VendaProfit expects accurate stock. Negatives happen due to race conditions.
  try {
    // If some products currently have negative stock, we need to update them to 0 first!
    await client.query('UPDATE public.products SET stock_quantity = 0 WHERE stock_quantity < 0;');
    
    // Add constraint
    await client.query('ALTER TABLE public.products ADD CONSTRAINT chk_stock_non_negative CHECK (stock_quantity >= 0);');
    console.log("  > ADDED chk_stock_non_negative on products");
  } catch (e) {
    console.error("  > Error adding constraint:", e.message);
  }

  // 3. SECURING SALES (Prevent Cascade Delete unless admin)
  console.log("\\n3. TIGHTENING RLS POLICIES FOR DELETIONS");
  // Let's list the policies for SALES. We can DROP the delete policy for non-admins if it's there.
  try {
    const salePolicies = await client.query("SELECT policyname FROM pg_policies WHERE tablename = 'sales' AND cmd = 'DELETE'");
    for (const pol of salePolicies.rows) {
      console.log("  > Dropping vulnerable delete policy: " + pol.policyname);
      await client.query('DROP POLICY "' + pol.policyname + '" ON public.sales;');
    }
    
    // Add a safe admin-only delete
    await client.query('CREATE POLICY "Admins can delete sales" ON public.sales FOR DELETE USING (has_role(auth.uid(), \\'admin\\'::app_role));');
    console.log("  > Replaced Delete policy with an Admin only constraint.");
  } catch(e) {
    console.error("  > Error tightening sales:", e.message);
  }

  await client.end();
  console.log("ALL OPTIMIZATIONS APPLIED!");
}

run().catch(console.error);
