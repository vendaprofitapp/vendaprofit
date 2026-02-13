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
  shipping_source?: string;
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
  const baseURL = "https://melhorenvio.com.br/api/v2/me";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "User-Agent": "VendaProfit (contato@vendaprofit.com)",
  };

  // Step 1: Add to cart
  const cartResponse = await fetch(`${baseURL}/cart`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: { postal_code: req.origin_zip },
      to: {
        name: req.customer_name || "Cliente",
        phone: req.customer_phone || "",
        postal_code: req.destination_zip,
        address: req.shipping_address || "",
      },
      products: [
        {
          name: "Produto",
          quantity: 1,
          unitary_value: 10,
        },
      ],
      volumes: [
        {
          weight: (req.weight_grams || 300) / 1000,
          width: req.width_cm || 11,
          height: req.height_cm || 2,
          length: req.length_cm || 16,
        },
      ],
      options: {
        insurance_value: 0,
        receipt: false,
        own_hand: false,
        non_commercial: true,
      },
    }),
  });

  if (!cartResponse.ok) {
    const error = await cartResponse.text();
    console.error("Cart error:", error);
    throw new Error(`Erro ao adicionar ao carrinho: ${error}`);
  }

  const cartData = await cartResponse.json();
  const orderId = cartData.id;

  // Step 2: Checkout (purchase)
  const checkoutResponse = await fetch(`${baseURL}/shipment/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({ orders: [orderId] }),
  });

  if (!checkoutResponse.ok) {
    const error = await checkoutResponse.text();
    console.error("Checkout error:", error);
    throw new Error(`Erro no checkout: ${error}`);
  }

  await checkoutResponse.json();

  // Step 3: Generate label
  const generateResponse = await fetch(`${baseURL}/shipment/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ orders: [orderId] }),
  });

  if (!generateResponse.ok) {
    const error = await generateResponse.text();
    console.error("Generate error:", error);
    throw new Error(`Erro ao gerar etiqueta: ${error}`);
  }

  await generateResponse.json();

  // Step 4: Print label (get PDF URL)
  const printResponse = await fetch(`${baseURL}/shipment/print`, {
    method: "POST",
    headers,
    body: JSON.stringify({ orders: [orderId], mode: "public" }),
  });

  if (!printResponse.ok) {
    const error = await printResponse.text();
    console.error("Print error:", error);
    throw new Error(`Erro ao imprimir etiqueta: ${error}`);
  }

  const printData = await printResponse.json();
  const labelUrl = printData.url || "";

  // Step 5: Get tracking
  const trackingResponse = await fetch(`${baseURL}/shipment/tracking`, {
    method: "POST",
    headers,
    body: JSON.stringify({ orders: [orderId] }),
  });

  let tracking = "";
  if (trackingResponse.ok) {
    const trackingData = await trackingResponse.json();
    const firstOrder = Object.values(trackingData)?.[0] as any;
    tracking = firstOrder?.tracking || orderId;
  } else {
    tracking = orderId;
  }

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
      shipping_source,
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

    const source = (shipping_source || "").toLowerCase();

    if (
      (source.includes("melhor envio") || source === "melhor envio") &&
      profile.melhor_envio_token
    ) {
      const result = await purchaseShippingMelhorEnvio(
        {
          sale_id,
          shipping_company,
          shipping_source,
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
        profile.melhor_envio_token
      );
      labelUrl = result.labelUrl;
      tracking = result.tracking;
    } else if (
      (source.includes("superfrete") || source === "superfrete") &&
      profile.superfrete_token
    ) {
      const result = await purchaseShippingSuperFrete(
        {
          sale_id,
          shipping_company,
          shipping_source,
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
    } else if (profile.melhor_envio_token) {
      // Fallback: if source not specified but user has Melhor Envio token, use it
      const result = await purchaseShippingMelhorEnvio(
        {
          sale_id,
          shipping_company,
          shipping_source,
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
        profile.melhor_envio_token
      );
      labelUrl = result.labelUrl;
      tracking = result.tracking;
    } else if (profile.superfrete_token) {
      // Fallback: use SuperFrete token
      const result = await purchaseShippingSuperFrete(
        {
          sale_id,
          shipping_company,
          shipping_source,
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
