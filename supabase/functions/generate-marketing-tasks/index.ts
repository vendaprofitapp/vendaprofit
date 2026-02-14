import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownerId = user.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();

    // Get store slug
    const { data: storeData } = await supabase
      .from("store_settings")
      .select("store_slug")
      .eq("owner_id", ownerId)
      .maybeSingle();

    const storeSlug = storeData?.store_slug || "";

    // Fetch data in parallel
    const [viewsRes, cartItemsRes, productsRes, searchLogsRes, salesRes] = await Promise.all([
      supabase
        .from("catalog_product_views")
        .select("product_id")
        .eq("owner_id", ownerId)
        .gte("created_at", thirtyDaysAgo),
      supabase
        .from("lead_cart_items")
        .select("product_id")
        .eq("status", "abandoned")
        .gte("created_at", thirtyDaysAgo),
      supabase
        .from("products")
        .select("id, name, stock_quantity, price")
        .eq("owner_id", ownerId)
        .eq("is_active", true),
      supabase
        .from("catalog_search_logs")
        .select("search_term, results_count")
        .eq("owner_id", ownerId)
        .gte("created_at", thirtyDaysAgo),
      supabase
        .from("sale_items")
        .select("product_id, sales!inner(owner_id, created_at)")
        .eq("sales.owner_id", ownerId)
        .gte("sales.created_at", thirtyDaysAgo),
    ]);

    // Count views per product
    const viewCounts = new Map<string, number>();
    (viewsRes.data || []).forEach((v: any) => {
      viewCounts.set(v.product_id, (viewCounts.get(v.product_id) || 0) + 1);
    });

    // Count cart adds per product
    const cartCounts = new Map<string, number>();
    (cartItemsRes.data || []).forEach((c: any) => {
      if (c.product_id) cartCounts.set(c.product_id, (cartCounts.get(c.product_id) || 0) + 1);
    });

    // Count sales per product
    const saleCounts = new Map<string, number>();
    (salesRes.data || []).forEach((s: any) => {
      saleCounts.set(s.product_id, (saleCounts.get(s.product_id) || 0) + 1);
    });

    // Views in last 15 days
    const recentViews = new Map<string, number>();
    const fifteenDaysAgoTime = new Date(fifteenDaysAgo).getTime();
    // We already have all views from 30 days, filter by created_at for 15 days
    // Since we only have product_id, we need a separate query for 15-day views
    const { data: recentViewsData } = await supabase
      .from("catalog_product_views")
      .select("product_id")
      .eq("owner_id", ownerId)
      .gte("created_at", fifteenDaysAgo);
    (recentViewsData || []).forEach((v: any) => {
      recentViews.set(v.product_id, (recentViews.get(v.product_id) || 0) + 1);
    });

    const products = productsRes.data || [];
    const tasks: any[] = [];
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const product of products) {
      const views = viewCounts.get(product.id) || 0;
      const carts = cartCounts.get(product.id) || 0;
      const sales = saleCounts.get(product.id) || 0;
      const recent = recentViews.get(product.id) || 0;

      // 1. Alta Objeção: >= 10 views, 0 cart adds
      if (views >= 10 && carts === 0 && sales === 0) {
        tasks.push({
          owner_id: ownerId,
          product_id: product.id,
          task_type: "high_objection",
          title: "Quebre a Objeção!",
          description: `O produto ${product.name} chamou a atenção de ${views} pessoas, mas ninguém comprou. Grave um Stories provando a peça, mostrando detalhes do tecido para gerar confiança.`,
          product_name: product.name,
          metric_value: views,
          metric_secondary: 0,
          store_slug: storeSlug,
          expires_at: expiresAt,
          is_completed: false,
        });
      }

      // 2. Ouro Escondido: < 5 views, >= 2 cart adds ou vendas
      if (views < 5 && (carts >= 2 || sales >= 2)) {
        const conversionRate = views > 0 ? ((carts + sales) / views * 100) : 100;
        tasks.push({
          owner_id: ownerId,
          product_id: product.id,
          task_type: "hidden_gold",
          title: "Acelere as Vendas!",
          description: `O seu ${product.name} é um campeão silencioso: converte muito bem. Ele precisa ser a estrela do seu Feed. Faça um Reels focado exclusivamente nele.`,
          product_name: product.name,
          metric_value: carts + sales,
          metric_secondary: Math.round(conversionRate * 100) / 100,
          store_slug: storeSlug,
          expires_at: expiresAt,
          is_completed: false,
        });
      }

      // 3. Giro de Capital: >= 5 unidades, 0 views últimos 15 dias
      if (product.stock_quantity >= 5 && recent === 0) {
        const stockValue = product.stock_quantity * (product.price || 0);
        tasks.push({
          owner_id: ownerId,
          product_id: product.id,
          task_type: "capital_freeze",
          title: "Descongele o seu Dinheiro!",
          description: `Tem ${product.stock_quantity} unidades de ${product.name} paradas. Monte 3 looks diferentes misturando esta peça com as mais vendidas e faça um post carrossel "3 formas de usar".`,
          product_name: product.name,
          metric_value: product.stock_quantity,
          metric_secondary: stockValue,
          store_slug: storeSlug,
          expires_at: expiresAt,
          is_completed: false,
        });
      }
    }

    // 4. SEO - Demanda Reprimida: termos com >= 3 pesquisas e 0 resultados
    const searchTermMap = new Map<string, { count: number; zeroResults: number }>();
    (searchLogsRes.data || []).forEach((log: any) => {
      const term = (log.search_term || "").toLowerCase().trim();
      if (!term) return;
      const entry = searchTermMap.get(term) || { count: 0, zeroResults: 0 };
      entry.count++;
      if (log.results_count === 0) entry.zeroResults++;
      searchTermMap.set(term, entry);
    });

    for (const [term, stats] of searchTermMap) {
      if (stats.count >= 3 && stats.zeroResults >= 3) {
        tasks.push({
          owner_id: ownerId,
          product_id: null,
          task_type: "search_demand",
          title: "Dinheiro a fugir!",
          description: `Tivemos ${stats.count} pesquisas por "${term}" na sua loja sem resultados. Se tem este tipo de produto, edite o nome para incluir esta palavra.`,
          product_name: term,
          metric_value: stats.count,
          metric_secondary: 0,
          store_slug: storeSlug,
          expires_at: expiresAt,
          is_completed: false,
        });
      }
    }

    // Delete old non-completed tasks and insert new ones
    await supabase
      .from("marketing_tasks")
      .delete()
      .eq("owner_id", ownerId)
      .eq("is_completed", false);

    if (tasks.length > 0) {
      await supabase.from("marketing_tasks").insert(tasks);
    }

    return new Response(JSON.stringify({ tasks_generated: tasks.length, tasks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
