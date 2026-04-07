// Vercel Edge Function — serve Open Graph dinâmico para bots de redes sociais
// Arquivo: /api/og-store.ts
// Rota: /api/og-store?slug=nome-da-loja

export const config = { runtime: "edge" };

const BOT_AGENTS = [
  "whatsapp", "facebookexternalhit", "facebot", "twitterbot",
  "telegrambot", "linkedinbot", "slackbot", "discordbot",
  "googlebot", "bingbot", "applebot", "pinterestbot", "embedly",
];

function isBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_AGENTS.some((b) => lower.includes(b));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";
  const ua = req.headers.get("user-agent") || "";

  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }

  // Redireciona usuários reais para a loja diretamente
  if (!isBot(ua)) {
    return Response.redirect(`https://vendaprofit.com.br/${slug}`, 302);
  }

  const supabaseUrl = "https://nkmktefsbvhjexodkbtw.supabase.co";
  const supabaseKey =
    (globalThis as any).VITE_SUPABASE_PUBLISHABLE_KEY ||
    (globalThis as any).SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rbWt0ZWZzYnZoamV4b2RrYnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjMwNjksImV4cCI6MjA5MDYzOTA2OX0.oz3GFu0uUtNpzQEj-ei3Ml4LGiKM6Y_mVBjBiWJ8nDQ";

  try {
    const apiUrl = `${supabaseUrl}/rest/v1/store_settings?store_slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=store_name,store_description,logo_url,banner_url,primary_color&limit=1`;

    const res = await fetch(apiUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    const rows = await res.json();
    const store = rows?.[0];

    if (!store) {
      // Loja não encontrada — retorna OG genérico
      return buildOGResponse(
        slug,
        "Venda PROFIT",
        "Catálogo de produtos",
        "https://vendaprofit.com.br/favicon.png",
        "#DA2576"
      );
    }

    const ogImage = store.logo_url || store.banner_url || "https://vendaprofit.com.br/favicon.png";
    return buildOGResponse(
      slug,
      store.store_name || "Venda PROFIT",
      store.store_description || `Confira o catálogo de ${store.store_name || "nossa loja"}`,
      ogImage,
      store.primary_color || "#DA2576"
    );
  } catch {
    return buildOGResponse(
      slug,
      "Venda PROFIT",
      "Catálogo de produtos",
      "https://vendaprofit.com.br/favicon.png",
      "#DA2576"
    );
  }
}

function buildOGResponse(
  slug: string,
  name: string,
  description: string,
  image: string,
  themeColor: string
): Response {
  const siteUrl = `https://vendaprofit.com.br/${slug}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(name)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="theme-color" content="${escapeHtml(themeColor)}" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(siteUrl)}" />
  <meta property="og:title" content="${escapeHtml(name)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="800" />
  <meta property="og:image:height" content="800" />
  <meta property="og:image:alt" content="${escapeHtml(name)}" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:site_name" content="${escapeHtml(name)}" />

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(name)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body>
  <a href="${escapeHtml(siteUrl)}">${escapeHtml(name)}</a>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
    },
  });
}
