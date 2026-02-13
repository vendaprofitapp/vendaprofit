import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProductDimensions {
  weight_grams: number;
  width_cm: number;
  height_cm: number;
  length_cm: number;
  quantity: number;
}

interface ShippingOption {
  carrier: string;
  service: string;
  price: number;
  delivery_days: number;
  source: string;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function quoteMelhorEnvio(
  token: string,
  originZip: string,
  destinationZip: string,
  products: ProductDimensions[]
): Promise<ShippingOption[]> {
  try {
    const body = {
      from: { postal_code: originZip },
      to: { postal_code: destinationZip },
      products: products.map((p) => ({
        weight: p.weight_grams / 1000,
        width: p.width_cm,
        height: p.height_cm,
        length: p.length_cm,
        quantity: p.quantity,
        insurance_value: 0,
      })),
    };

    const response = await fetchWithTimeout(
      "https://melhorenvio.com.br/api/v2/me/shipment/calculate",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "VendaProfit (contato@vendaprofit.com)",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.error("Melhor Envio error:", response.status, await response.text());
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data)) return [];

    return data
      .filter((item: any) => !item.error && item.price)
      .map((item: any) => ({
        carrier: item.company?.name || "Transportadora",
        service: item.name || "Serviço",
        price: parseFloat(item.price) || 0,
        delivery_days: parseInt(item.delivery_time) || parseInt(item.delivery_range?.max) || 0,
        source: "Melhor Envio",
      }));
  } catch (error) {
    console.error("Melhor Envio fetch error:", error);
    return [];
  }
}

async function quoteSuperfrete(
  token: string,
  originZip: string,
  destinationZip: string,
  products: ProductDimensions[]
): Promise<ShippingOption[]> {
  try {
    const totalWeight = products.reduce((s, p) => s + (p.weight_grams * p.quantity), 0);
    const maxWidth = Math.max(...products.map((p) => p.width_cm));
    const maxLength = Math.max(...products.map((p) => p.length_cm));
    const totalHeight = products.reduce((s, p) => s + (p.height_cm * p.quantity), 0);

    const body = {
      from: originZip,
      to: destinationZip,
      services: "1,2,17",
      package: {
        weight: totalWeight / 1000,
        width: maxWidth,
        height: Math.min(totalHeight, 100),
        length: maxLength,
      },
      options: {
        own_hand: false,
        receipt: false,
        insurance_value: 0,
      },
    };

    const response = await fetchWithTimeout(
      "https://api.superfrete.com/api/v0/calculator",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "VendaProfit",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.error("SuperFrete error:", response.status, await response.text());
      return [];
    }

    const data = await response.json();

    const results = Array.isArray(data) ? data : data?.dispatchers || data?.results || [];
    if (!Array.isArray(results)) return [];

    return results
      .filter((item: any) => !item.error && (item.price || item.vlr_frete))
      .map((item: any) => ({
        carrier: item.company_name || item.carrier || "Transportadora",
        service: item.name || item.description || "Serviço",
        price: parseFloat(item.price || item.vlr_frete) || 0,
        delivery_days: parseInt(item.delivery_time || item.prazo) || 0,
        source: "SuperFrete",
      }));
  } catch (error) {
    console.error("SuperFrete fetch error:", error);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      origin_zip,
      destination_zip,
      products,
      melhor_envio_token,
      superfrete_token,
    } = await req.json();

    if (!origin_zip || !destination_zip) {
      return new Response(
        JSON.stringify({ error: "CEP de origem e destino são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ error: "Informe os produtos para cotação" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!melhor_envio_token && !superfrete_token) {
      return new Response(
        JSON.stringify({ error: "Configure pelo menos um token de frete nas Configurações" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query APIs in parallel
    const promises: Promise<ShippingOption[]>[] = [];

    if (melhor_envio_token) {
      promises.push(quoteMelhorEnvio(melhor_envio_token, origin_zip, destination_zip, products));
    }
    if (superfrete_token) {
      promises.push(quoteSuperfrete(superfrete_token, origin_zip, destination_zip, products));
    }

    const results = await Promise.all(promises);
    const allOptions = results.flat().sort((a, b) => a.price - b.price);

    if (allOptions.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Não foi possível obter cotações. Verifique seus tokens e tente novamente.",
          options: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ options: allOptions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("quote-shipping error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar cotação de frete" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
