import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const storeId = url.searchParams.get("store_id");
  const token = url.searchParams.get("token");
  const format = url.searchParams.get("format") || "google";

  if (!storeId || !token) {
    return new Response("Missing store_id or token", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Validate store_id + token
  const { data: store, error: storeError } = await supabase
    .from("store_settings")
    .select("id, owner_id, store_slug, store_name, feed_token")
    .eq("id", storeId)
    .eq("feed_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (storeError || !store) {
    return new Response("Invalid store_id or token", { status: 403 });
  }

  const origin = url.origin.includes("supabase")
    ? "https://vendaprofit.com.br"
    : url.origin;
  const storeLink = `${origin}/loja/${store.store_slug}`;

  // 2. Fetch products in batches (Always Profit: stock > 0)
  const allProducts: any[] = [];
  const PAGE_SIZE = 500;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, description, price, image_url, stock_quantity, category, main_category")
      .eq("owner_id", store.owner_id)
      .eq("is_active", true)
      .gt("stock_quantity", 0)
      .range(from, from + PAGE_SIZE - 1)
      .order("created_at", { ascending: false });

    if (error) {
      return new Response(`Error fetching products: ${error.message}`, { status: 500 });
    }

    if (products && products.length > 0) {
      allProducts.push(...products);
      from += PAGE_SIZE;
      hasMore = products.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  const cacheHeaders = {
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
  };

  if (format === "meta") {
    return generateCSV(allProducts, store, storeLink, cacheHeaders);
  }
  return generateXML(allProducts, store, storeLink, cacheHeaders);
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateXML(
  products: any[],
  store: any,
  storeLink: string,
  headers: Record<string, string>
): Response {
  const items = products
    .map(
      (p) => `    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(p.description || p.name)}</g:description>
      <g:link>${storeLink}?product=${p.id}</g:link>
      <g:image_link>${escapeXml(p.image_url || "")}</g:image_link>
      <g:price>${Number(p.price).toFixed(2)} BRL</g:price>
      <g:availability>in_stock</g:availability>
      <g:condition>new</g:condition>
      <g:brand>${escapeXml(store.store_name || "")}</g:brand>
      ${p.main_category ? `<g:product_type>${escapeXml(p.main_category)}</g:product_type>` : ""}
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${escapeXml(store.store_name || "")}</title>
    <link>${storeLink}</link>
    <description>Catálogo de produtos - ${escapeXml(store.store_name || "")}</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { ...headers, "Content-Type": "application/xml; charset=utf-8" },
  });
}

function escapeCSV(str: string): string {
  if (!str) return "";
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(
  products: any[],
  store: any,
  storeLink: string,
  headers: Record<string, string>
): Response {
  const headerRow = "id,title,description,availability,condition,price,link,image_link,brand";
  const rows = products.map(
    (p) =>
      [
        escapeCSV(p.id),
        escapeCSV(p.name),
        escapeCSV(p.description || p.name),
        "in stock",
        "new",
        `${Number(p.price).toFixed(2)} BRL`,
        `${storeLink}?product=${p.id}`,
        escapeCSV(p.image_url || ""),
        escapeCSV(store.store_name || ""),
      ].join(",")
  );

  const csv = [headerRow, ...rows].join("\n");

  return new Response(csv, {
    headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "inline; filename=product-feed.csv" },
  });
}
