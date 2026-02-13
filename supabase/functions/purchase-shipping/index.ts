import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

if (Deno.env.get("DENO_ENVIRONMENT") === "test") {
  Deno.serve(() => new Response("OK"));
}

interface PurchaseShippingRequest {
  sale_id?: string;
  shipping_company: string;
  shipping_cost: number;
  destination_zip: string;
  origin_zip: string;
  weight_grams: number;
  width_cm: number;
  height_cm: number;
  length_cm: number;
  customer_name?: string;
  customer_phone?: string;
  shipping_address?: string;
  receiver_phone?: string;
}

async function purchaseShippingMelhorEnvio(
  req: PurchaseShippingRequest,
  token: string
) {
  const melhorEnvioURL = "https://api.melhorenvio.com.br/v2/shipment";

  // First, create the shipment
  const shipmentResponse = await fetch(melhorEnvioURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      from: {
        name: "Vendedor",
        phone: "11000000000",
        email: "seller@vendaprofit.com",
        address: "Endereço de origem",
        number: "0",
        complement: "",
        city: "São Paulo",
        state: "SP",
        country_id: 1,
        postal_code: req.origin_zip,
      },
      to: {
        name: req.customer_name || "Cliente",
        phone: req.receiver_phone || req.customer_phone || "11000000000",
        email: "cliente@example.com",
        address: req.shipping_address || "Endereço do cliente",
        number: "0",
        complement: "",
        city: "São Paulo",
        state: "SP",
        country_id: 1,
        postal_code: req.destination_zip,
      },
      service: 4, // Correios PAC
      products: [
        {
          name: "Produto",
          quantity: 1,
          unitary_value: req.shipping_cost,
          weight: req.weight_grams,
          width: req.width_cm,
          height: req.height_cm,
          length: req.length_cm,
        },
      ],
    }),
  });

  if (!shipmentResponse.ok) {
    const error = await shipmentResponse.json();
    throw new Error(`Melhor Envio error: ${JSON.stringify(error)}`);
  }

  const shipmentData = await shipmentResponse.json();

  // Purchase the shipment
  const purchaseResponse = await fetch(
    `${melhorEnvioURL}/${shipmentData.id}/buy`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!purchaseResponse.ok) {
    const error = await purchaseResponse.json();
    throw new Error(`Melhor Envio purchase error: ${JSON.stringify(error)}`);
  }

  const purchaseData = await purchaseResponse.json();

  // Get tracking label
  const labelResponse = await fetch(
    `${melhorEnvioURL}/${purchaseData.id}/label`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!labelResponse.ok) {
    throw new Error("Failed to get label from Melhor Envio");
  }

  const labelUrl = labelResponse.url;
  const tracking = purchaseData.tracking;

  return { labelUrl, tracking };
}

async function purchaseShippingSuperFrete(
  req: PurchaseShippingRequest,
  token: string
) {
  const superFreteURL = "https://api.superfrete.com/shipment";

  const response = await fetch(superFreteURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": token,
    },
    body: JSON.stringify({
      from: {
        name: "Vendedor",
        phone: "11000000000",
        address: "Endereço",
        number: "0",
        city: "São Paulo",
        state: "SP",
        postal_code: req.origin_zip,
      },
      to: {
        name: req.customer_name || "Cliente",
        phone: req.receiver_phone || req.customer_phone,
        address: req.shipping_address || "Endereço do cliente",
        city: "São Paulo",
        state: "SP",
        postal_code: req.destination_zip,
      },
      products: [
        {
          name: "Produto",
          quantity: 1,
          value: req.shipping_cost,
          weight: req.weight_grams,
          width: req.width_cm,
          height: req.height_cm,
          depth: req.length_cm,
        },
      ],
      service: "04065", // PAC
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`SuperFrete error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  return {
    labelUrl: data.label_url,
    tracking: data.tracking_number,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      sale_id,
      shipping_company,
      destination_zip,
      origin_zip,
      weight_grams,
      width_cm,
      height_cm,
      length_cm,
      customer_name,
      customer_phone,
      shipping_address,
      receiver_phone,
    }: PurchaseShippingRequest = await req.json();

    // Get auth token from header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabase.auth.getClaims(token);

    if (userError || !userData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = userData.claims.sub;

    // Get user's shipping tokens
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("melhor_envio_token, superfrete_token")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 400, headers: corsHeaders }
      );
    }

    let labelUrl: string;
    let tracking: string;

    // Choose the appropriate service
    if (
      shipping_company.toLowerCase().includes("melhor envio") &&
      profile.melhor_envio_token
    ) {
      const result = await purchaseShippingMelhorEnvio(
        {
          sale_id,
          shipping_company,
          shipping_cost: 0, // Will be calculated by API
          destination_zip,
          origin_zip,
          weight_grams,
          width_cm,
          height_cm,
          length_cm,
          customer_name,
          customer_phone,
          shipping_address,
          receiver_phone,
        },
        profile.melhor_envio_token
      );
      labelUrl = result.labelUrl;
      tracking = result.tracking;
    } else if (
      shipping_company.toLowerCase().includes("superfrete") &&
      profile.superfrete_token
    ) {
      const result = await purchaseShippingSuperFrete(
        {
          sale_id,
          shipping_company,
          shipping_cost: 0,
          destination_zip,
          origin_zip,
          weight_grams,
          width_cm,
          height_cm,
          length_cm,
          customer_name,
          customer_phone,
          shipping_address,
          receiver_phone,
        },
        profile.superfrete_token
      );
      labelUrl = result.labelUrl;
      tracking = result.tracking;
    } else {
      return new Response(
        JSON.stringify({
          error: "Serviço não configurado ou token ausente",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Update sale with label URL and tracking (only if sale_id provided)
    if (sale_id) {
      const { error: updateError } = await supabase
        .from("sales")
        .update({
          shipping_label_url: labelUrl,
          shipping_tracking: tracking,
        })
        .eq("id", sale_id)
        .eq("owner_id", userId);

      if (updateError) {
        throw updateError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        label_url: labelUrl,
        tracking: tracking,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro ao gerar etiqueta",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
