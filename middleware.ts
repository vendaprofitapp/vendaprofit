// Vercel Edge Middleware — funciona com Vite estático + Vercel
// Detecta bots de redes sociais e serve OG tags dinâmicas da loja
// Usuários reais passam diretamente para o SPA React

const BOT_AGENTS = [
  "whatsapp",
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "telegrambot",
  "linkedinbot",
  "slackbot",
  "discordbot",
  "googlebot",
  "bingbot",
  "applebot",
  "pinterestbot",
  "embedly",
];

// Rotas de app que NUNCA devem ser interceptadas
const PASS_THROUGH_PREFIXES = [
  "/auth", "/stock", "/sales", "/customers", "/reports", "/settings",
  "/financial", "/marketing", "/partner-points", "/orders", "/consignments",
  "/consortiums", "/evento", "/admin", "/b2b-orders", "/analytics",
  "/my-store", "/catalog-orders", "/tutorial", "/hub-", "/plano-expirado",
  "/p/", "/contrato/", "/bag/", "/bazar/", "/_", "/api",
  "/favicon", "/icon", "/manifest", "/assets",
];

const SUPABASE_URL = "https://nkmktefsbvhjexodkbtw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rbWt0ZWZzYnZoamV4b2RrYnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjMwNjksImV4cCI6MjA5MDYzOTA2OX0.oz3GFu0uUtNpzQEj-ei3Ml4LGiKM6Y_mVBjBiWJ8nDQ";

function isBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_AGENTS.some((b) => lower.includes(b));
}

function isPassThrough(pathname: string): boolean {
  // Passa estático: arquivos com extensão
  if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return true;
  return PASS_THROUGH_PREFIXES.some((p) => pathname.startsWith(p));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(slug: string, name: string, description: string, image: string, color: string): string {
  const url = `https://vendaprofit.com.br/${slug}`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(name)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="theme-color" content="${escapeHtml(color)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(url)}" />
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
<body><a href="${escapeHtml(url)}">${escapeHtml(name)}</a></body>
</html>`;
}

export default async function middleware(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const ua = req.headers.get("user-agent") || "";

  // Deixa passar: não é bot ou é rota de app
  if (!isBot(ua) || isPassThrough(pathname)) {
    return new Response(null, {
      status: 200,
      headers: { "x-middleware-next": "1" },
    });
  }

  // Extrai slug (/nome-da-loja → "nome-da-loja")
  const slug = pathname.replace(/^\//, "").split("/")[0];
  if (!slug || slug.length < 2) {
    return new Response(null, { status: 200, headers: { "x-middleware-next": "1" } });
  }

  try {
    const apiUrl = `${SUPABASE_URL}/rest/v1/store_settings?store_slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=store_name,store_description,logo_url,banner_url,primary_color&limit=1`;

    const res = await fetch(apiUrl, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    const rows: any[] = await res.json();
    const store = rows?.[0];

    const name = store?.store_name || "Venda PROFIT";
    const description = store?.store_description || `Confira o catálogo de ${name}`;
    const image = store?.logo_url || store?.banner_url || "https://vendaprofit.com.br/favicon.png";
    const color = store?.primary_color || "#DA2576";

    return new Response(buildHtml(slug, name, description, image, color), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
      },
    });
  } catch {
    // Em caso de erro, deixa o SPA responder normalmente
    return new Response(null, { status: 200, headers: { "x-middleware-next": "1" } });
  }
}

export const config = {
  matcher: ["/((?!_next|api|favicon\\.png|icon-|manifest\\.json|assets).*)"],
};
