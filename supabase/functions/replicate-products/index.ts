import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { source_user_id, target_user_ids } = await req.json();

    if (!source_user_id || !target_user_ids || !Array.isArray(target_user_ids)) {
      return new Response(JSON.stringify({ error: 'Invalid params' }), { status: 400, headers: corsHeaders });
    }

    // 1. Fetch all active products from source
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('owner_id', source_user_id)
      .eq('is_active', true)
      .limit(5000);

    if (prodErr) throw prodErr;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ message: 'No products found', inserted: 0 }), { headers: corsHeaders });
    }

    // 2. Fetch all variants from source
    const sourceProductIds = products.map(p => p.id);
    const { data: variants, error: varErr } = await supabase
      .from('product_variants')
      .select('*')
      .in('product_id', sourceProductIds);

    if (varErr) throw varErr;

    const results: Record<string, { inserted: number; skipped: number; variants_inserted: number }> = {};

    for (const targetUserId of target_user_ids) {
      // 3. Fetch existing product names for target user
      const { data: existingProducts } = await supabase
        .from('products')
        .select('name')
        .eq('owner_id', targetUserId)
        .limit(10000);

      const existingNames = new Set(
        (existingProducts || []).map(p => p.name.toLowerCase().trim())
      );

      // 4. Filter new products only
      const toInsert = products
        .filter(p => !existingNames.has(p.name.toLowerCase().trim()))
        .map(p => {
          const { id: _oldId, owner_id: _owner, created_at: _ca, updated_at: _ua, stock_quantity: _sq, ...rest } = p;
          return {
            ...rest,
            owner_id: targetUserId,
            stock_quantity: 0,
            supplier_id: null, // do not link to source user's supplier
          };
        });

      if (toInsert.length === 0) {
        results[targetUserId] = { inserted: 0, skipped: products.length, variants_inserted: 0 };
        continue;
      }

      // 5. Insert products in batches of 100
      let inserted = 0;
      const insertedProductMap: Record<string, string> = {}; // oldId -> newId

      for (let i = 0; i < toInsert.length; i += 100) {
        const batch = toInsert.slice(i, i + 100);
        const { data: insertedData, error: insertErr } = await supabase
          .from('products')
          .insert(batch)
          .select('id, name');

        if (insertErr) throw insertErr;
        inserted += insertedData?.length || 0;

        // Map old product id -> new product id by name
        if (insertedData) {
          for (const newProd of insertedData) {
            const oldProd = products.find(p =>
              p.name.toLowerCase().trim() === newProd.name.toLowerCase().trim()
            );
            if (oldProd) {
              insertedProductMap[oldProd.id] = newProd.id;
            }
          }
        }
      }

      // 6. Insert variants for inserted products
      let variantsInserted = 0;
      const variantsToInsert: any[] = [];

      for (const [oldProductId, newProductId] of Object.entries(insertedProductMap)) {
        const productVariants = (variants || []).filter(v => v.product_id === oldProductId);
        for (const v of productVariants) {
          const { id: _vid, product_id: _pid, created_at: _vca, updated_at: _vua, ...varRest } = v;
          variantsToInsert.push({
            ...varRest,
            product_id: newProductId,
            stock_quantity: 0,
          });
        }
      }

      if (variantsToInsert.length > 0) {
        for (let i = 0; i < variantsToInsert.length; i += 200) {
          const batch = variantsToInsert.slice(i, i + 200);
          const { error: vErr } = await supabase.from('product_variants').insert(batch);
          if (vErr) throw vErr;
          variantsInserted += batch.length;
        }
      }

      results[targetUserId] = {
        inserted,
        skipped: products.length - inserted,
        variants_inserted: variantsInserted,
      };
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
