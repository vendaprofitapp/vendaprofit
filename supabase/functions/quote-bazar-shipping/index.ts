import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ShippingOption {
  carrier: string;
  service: string;
  service_id: number | null;
  price: number;
  delivery_days: number;
  source: string;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function quoteMelhorEnvio(
  token: string,
  originZip: string,
  destinationZip: string,
  weight: number,
  width: number,
  height: number,
  length: number
): Promise<ShippingOption[]> {
  try {
    const body = {
      from: { postal_code: originZip },
      to: { postal_code: destinationZip },
      products: [{
        weight: weight / 1000,
        width, height, length,
        quantity: 1,
        insurance_value: 0,
      }],
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
        service_id: item.id || null,
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
  weight: number,
  width: number,
  height: number,
  length: number
): Promise<ShippingOption[]> {
  try {
    const body = {
      from: { postal_code: originZip },
      to: { postal_code: destinationZip },
      services: "1,2,17",
      package: {
        weight: weight / 1000,
        width, height: Math.min(height, 100), length,
      },
      options: { own_hand: false, receipt: false, insurance_value: 0 },
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
        service_id: item.id || null,
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
    const { owner_id, origin_zip, destination_zip, weight_grams, width_cm, height_cm, length_cm } = await req.json();

    if (!owner_id || !origin_zip || !destination_zip) {
      return new Response(
        JSON.stringify({ error: "owner_id, origin_zip e destination_zip são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to read store owner's shipping tokens
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("melhor_envio_token, superfrete_token")
      .eq("id", owner_id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Loja não encontrada ou sem configuração de frete" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { melhor_envio_token, superfrete_token } = profile;

    if (!melhor_envio_token && !superfrete_token) {
      return new Response(
        JSON.stringify({ error: "Loja sem serviço de frete configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const w = weight_grams || 300;
    const wi = width_cm || 11;
    const h = height_cm || 2;
    const l = length_cm || 16;

    const promises: Promise<ShippingOption[]>[] = [];
    if (melhor_envio_token) promises.push(quoteMelhorEnvio(melhor_envio_token, origin_zip, destination_zip, w, wi, h, l));
    if (superfrete_token) promises.push(quoteSuperfrete(superfrete_token, origin_zip, destination_zip, w, wi, h, l));

    const results = await Promise.all(promises);
    const allOptions = results.flat().sort((a, b) => a.price - b.price);

    return new Response(JSON.stringify({ options: allOptions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("quote-bazar-shipping error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar cotação de frete" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
