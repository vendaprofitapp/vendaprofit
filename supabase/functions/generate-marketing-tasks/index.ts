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

    const { data: storeData } = await supabase
      .from("store_settings")
      .select("store_slug")
      .eq("owner_id", ownerId)
      .maybeSingle();

    const storeSlug = storeData?.store_slug || "";

    // Fetch data in parallel
    const [viewsRes, cartItemsRes, productsRes, searchLogsRes, salesRes, recentViewsRes] = await Promise.all([
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
        .select("id, name, stock_quantity, price, category, category_2, category_3")
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
      supabase
        .from("catalog_product_views")
        .select("product_id")
        .eq("owner_id", ownerId)
        .gte("created_at", fifteenDaysAgo),
    ]);

    // Count views per product
    const viewCounts = new Map<string, number>();
    (viewsRes.data || []).forEach((v: any) => {
      viewCounts.set(v.product_id, (viewCounts.get(v.product_id) || 0) + 1);
    });

    const cartCounts = new Map<string, number>();
    (cartItemsRes.data || []).forEach((c: any) => {
      if (c.product_id) cartCounts.set(c.product_id, (cartCounts.get(c.product_id) || 0) + 1);
    });

    const saleCounts = new Map<string, number>();
    (salesRes.data || []).forEach((s: any) => {
      saleCounts.set(s.product_id, (saleCounts.get(s.product_id) || 0) + 1);
    });

    const recentViews = new Map<string, number>();
    (recentViewsRes.data || []).forEach((v: any) => {
      recentViews.set(v.product_id, (recentViews.get(v.product_id) || 0) + 1);
    });

    const products = productsRes.data || [];
    const tasks: any[] = [];
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // --- CONTENT SCENARIOS (existing) ---
    for (const product of products) {
      const views = viewCounts.get(product.id) || 0;
      const carts = cartCounts.get(product.id) || 0;
      const sales = saleCounts.get(product.id) || 0;
      const recent = recentViews.get(product.id) || 0;

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

    // --- SEO SCENARIO (existing) ---
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
      if (stats.count >= 1 && stats.zeroResults >= 1) {
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

    // --- GROUP SCENARIOS (new v3) ---
    // Fetch public groups (non-direct) and user's memberships
    const [publicGroupsRes, userMembershipsRes] = await Promise.all([
      supabase
        .from("groups")
        .select("id, name, description, profit_share_seller, profit_share_partner, invite_code")
        .eq("is_direct", false),
      supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", ownerId),
    ]);

    const publicGroups = publicGroupsRes.data || [];
    const userGroupIds = new Set((userMembershipsRes.data || []).map((m: any) => m.group_id));

    // Groups user is NOT a member of
    const availableGroups = publicGroups.filter((g: any) => !userGroupIds.has(g.id));

    if (availableGroups.length > 0) {
      // Fetch products shared in these available groups
      const availableGroupIds = availableGroups.map((g: any) => g.id);
      const { data: sharedProducts } = await supabase
        .from("product_partnerships")
        .select("group_id, product_id, products!inner(name, category, category_2, category_3, price)")
        .in("group_id", availableGroupIds);

      // Build group -> categories map
      const groupCategoryMap = new Map<string, { categories: Set<string>; productCount: number }>();
      (sharedProducts || []).forEach((sp: any) => {
        const entry = groupCategoryMap.get(sp.group_id) || { categories: new Set(), productCount: 0 };
        entry.productCount++;
        const p = sp.products;
        if (p.category) entry.categories.add(p.category.toLowerCase());
        if (p.category_2) entry.categories.add(p.category_2.toLowerCase());
        if (p.category_3) entry.categories.add(p.category_3.toLowerCase());
        groupCategoryMap.set(sp.group_id, entry);
      });

      // User's categories
      const userCategories = new Set<string>();
      products.forEach((p: any) => {
        if (p.category) userCategories.add(p.category.toLowerCase());
        if (p.category_2) userCategories.add(p.category_2.toLowerCase());
        if (p.category_3) userCategories.add(p.category_3.toLowerCase());
      });

      // Scenario A: Cross-sell - search terms with 0 results that match a group's categories
      const zeroResultTerms = Array.from(searchTermMap.entries())
        .filter(([_, stats]) => stats.zeroResults >= 1)
        .map(([term]) => term);

      for (const group of availableGroups) {
        const groupData = groupCategoryMap.get(group.id);
        if (!groupData || groupData.productCount === 0) continue;

        // Check if any zero-result search term matches a group category
        const matchedTerm = zeroResultTerms.find(term =>
          Array.from(groupData.categories).some(cat => cat.includes(term) || term.includes(cat))
        );

        if (matchedTerm) {
          const profitPercent = Math.round((group.profit_share_seller || 0.7) * 100);
          tasks.push({
            owner_id: ownerId,
            product_id: null,
            group_id: group.id,
            task_type: "group_cross_sell",
            title: "Complete o Look das suas Clientes!",
            description: `Notamos buscas por "${matchedTerm}" na sua loja, mas seu estoque nisso é zero. O Grupo ${group.name} tem ${groupData.productCount} produtos disponíveis para revenda imediata.`,
            product_name: group.name,
            metric_value: groupData.productCount,
            metric_secondary: profitPercent,
            store_slug: storeSlug,
            expires_at: expiresAt,
            is_completed: false,
          });
          continue; // one card per group max
        }

        // Scenario B: Opportunity - group has categories user doesn't have
        const newCategories = Array.from(groupData.categories).filter(cat => !userCategories.has(cat));
        if (newCategories.length > 0 && groupData.productCount >= 3) {
          const profitPercent = Math.round((group.profit_share_seller || 0.7) * 100);
          tasks.push({
            owner_id: ownerId,
            product_id: null,
            group_id: group.id,
            task_type: "group_opportunity",
            title: "Aumente seu Ticket Médio!",
            description: `Vendedoras estão lucrando com categorias que você ainda não trabalha. O Grupo ${group.name} é distribuidor com ${groupData.productCount} produtos disponíveis.`,
            product_name: group.name,
            metric_value: groupData.productCount,
            metric_secondary: profitPercent,
            store_slug: storeSlug,
            expires_at: expiresAt,
            is_completed: false,
          });
        }
      }
    }

    // Scenario C: Create Group - high stock value, low sales, no groups created
    const totalStockValue = products.reduce((sum, p) => sum + (p.stock_quantity * (p.price || 0)), 0);
    const totalSales = Array.from(saleCounts.values()).reduce((sum, c) => sum + c, 0);

    if (totalStockValue >= 5000 && totalSales < 10) {
      const { data: ownedGroups } = await supabase
        .from("groups")
        .select("id")
        .eq("created_by", ownerId)
        .eq("is_direct", false)
        .limit(1);

      if (!ownedGroups || ownedGroups.length === 0) {
        tasks.push({
          owner_id: ownerId,
          product_id: null,
          group_id: null,
          task_type: "group_create",
          title: "Torne-se um Fornecedor!",
          description: `Você tem R$ ${Math.round(totalStockValue).toLocaleString("pt-BR")} em estoque mas giro lento. Que tal ter um exército de vendedoras trabalhando para você? Crie um Grupo de Estoque Compartilhado.`,
          product_name: null,
          metric_value: products.length,
          metric_secondary: totalStockValue,
          store_slug: storeSlug,
          expires_at: expiresAt,
          is_completed: false,
        });
      }
    }

    // --- AD SCENARIOS (Épico 11) ---
    // Check if user has any ad integrations
    const { data: adIntegrations } = await supabase
      .from("user_ad_integrations")
      .select("platform, is_active")
      .eq("owner_id", ownerId);

    const hasActiveIntegration = (adIntegrations || []).some((i: any) => i.is_active);

    for (const product of products) {
      const views = viewCounts.get(product.id) || 0;
      const carts = cartCounts.get(product.id) || 0;
      const sales = saleCounts.get(product.id) || 0;
      const recent = recentViews.get(product.id) || 0;

      // ad_boost_meta: High stock (>10) AND high organic conversion (>5%)
      if (product.stock_quantity > 10 && views > 0) {
        const convRate = ((carts + sales) / views) * 100;
        if (convRate >= 5) {
          tasks.push({
            owner_id: ownerId,
            product_id: product.id,
            task_type: "ad_boost_meta",
            title: "Multiplique suas Vendas!",
            description: `Tem ${product.stock_quantity} unidades de ${product.name} com ${Math.round(convRate)}% de conversão orgânica. Vamos mostrar a mais pessoas na sua região?`,
            product_name: product.name,
            metric_value: product.stock_quantity,
            metric_secondary: Math.round(convRate * 100) / 100,
            store_slug: storeSlug,
            expires_at: expiresAt,
            is_completed: false,
          });
        }
      }

      // ad_google_pmax: Stock parado (>15 dias sem venda, >5 unidades)
      if (product.stock_quantity > 5 && recent === 0 && sales === 0) {
        tasks.push({
          owner_id: ownerId,
          product_id: product.id,
          task_type: "ad_google_pmax",
          title: "Ativar Máquina de Vendas no Google",
          description: `O ${product.name} está parado há mais de 15 dias com ${product.stock_quantity} unidades. O sistema pré-configurou um anúncio Performance Max para escoar este stock.`,
          product_name: product.name,
          metric_value: product.stock_quantity,
          metric_secondary: product.stock_quantity * (product.price || 0),
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
