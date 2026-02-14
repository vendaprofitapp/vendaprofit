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
  shipping_service_id?: number;
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
  // Parsed address fields
  destination_city?: string;
  destination_state?: string;
  destination_street?: string;
  destination_number?: string;
  destination_complement?: string;
  destination_neighborhood?: string;
  seller_name?: string;
  seller_phone?: string;
  seller_document?: string;
  customer_document?: string;
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
  const cartBody: any = {
    service: req.shipping_service_id || 3,
    from: {
      name: req.seller_name || "Vendedor",
      phone: req.seller_phone || "00000000000",
      email: "contato@vendaprofit.com",
      document: req.seller_document || "00000000000",
      postal_code: req.origin_zip,
      address: "Endereço do remetente",
      number: "0",
      city: "Cidade",
      state_abbr: "MG",
    },
    to: {
      name: req.customer_name || "Cliente",
      phone: req.customer_phone || "00000000000",
      email: "cliente@email.com",
      document: req.customer_document || "00000000000",
      postal_code: req.destination_zip,
      address: req.destination_street || "Endereço do destinatário",
      number: req.destination_number || "0",
      complement: req.destination_complement || "",
      district: req.destination_neighborhood || "Centro",
      city: req.destination_city || "Cidade",
      state_abbr: req.destination_state || "MG",
    },
    products: [
      {
        name: "Produto",
        quantity: 1,
        unitary_value: Math.max(req.shipping_cost || 1, 1),
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
      insurance_value: Math.max(req.shipping_cost || 26, 26),
      receipt: false,
      own_hand: false,
      non_commercial: true,
    },
  };

  console.log("Cart body:", JSON.stringify(cartBody));

  const cartResponse = await fetch(`${baseURL}/cart`, {
    method: "POST",
    headers,
    body: JSON.stringify(cartBody),
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
  const baseURL = "https://api.superfrete.com/api/v0";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "User-Agent": "VendaProfit (contato@vendaprofit.com)",
  };

  // Step 1: Create the tag (label)
  const tagBody = {
    from: {
      name: req.seller_name || "Vendedor",
      phone: req.seller_phone || "00000000000",
      document: req.seller_document || "00000000000",
      postal_code: req.origin_zip,
      address: "Endereço do remetente",
      number: "0",
      district: "Centro",
      city: "Cidade",
      state_abbr: "MG",
    },
    to: {
      name: req.customer_name || "Cliente",
      phone: req.receiver_phone || req.customer_phone || "00000000000",
      document: req.customer_document || "00000000000",
      postal_code: req.destination_zip,
      address: req.destination_street || "Endereço do cliente",
      number: req.destination_number || "",
      complement: req.destination_complement || "",
      district: req.destination_neighborhood || "NA",
      city: req.destination_city || "Cidade",
      state_abbr: (req.destination_state || "MG").toUpperCase(),
    },
    service: req.shipping_service_id || 1,
    products: [
      {
        name: "Produto",
        quantity: 1,
        unitary_value: Math.max(req.shipping_cost || 1, 1),
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
      insurance_value: Math.max(req.shipping_cost || 26, 26),
      receipt: false,
      own_hand: false,
      non_commercial: true,
    },
  };

  console.log("SuperFrete tag body:", JSON.stringify(tagBody));

  const tagResponse = await fetch(`${baseURL}/cart`, {
    method: "POST",
    headers,
    body: JSON.stringify(tagBody),
  });

  const tagResponseText = await tagResponse.text();

  if (!tagResponse.ok) {
    console.error("SuperFrete tag error:", tagResponse.status, tagResponseText);
    throw new Error(`SuperFrete tag error (${tagResponse.status}): ${tagResponseText.substring(0, 300)}`);
  }

  let tagData: any;
  try {
    tagData = JSON.parse(tagResponseText);
  } catch {
    throw new Error(`SuperFrete returned invalid JSON: ${tagResponseText.substring(0, 200)}`);
  }

  const tagId = tagData.id;
  console.log("SuperFrete tag created:", tagId);

  // Step 2: Checkout (pay the label using account balance)
  const checkoutResponse = await fetch(`${baseURL}/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({ orders: [tagId] }),
  });

  const checkoutText = await checkoutResponse.text();

  if (!checkoutResponse.ok) {
    console.error("SuperFrete checkout error:", checkoutResponse.status, checkoutText);
    throw new Error(`SuperFrete checkout error (${checkoutResponse.status}): ${checkoutText.substring(0, 300)}`);
  }

  let checkoutData: any = {};
  try {
    checkoutData = JSON.parse(checkoutText);
  } catch {
    console.warn("SuperFrete checkout response not JSON:", checkoutText.substring(0, 200));
  }
  console.log("SuperFrete checkout response:", JSON.stringify(checkoutData));

  // Extract label and tracking from checkout or tag data
  const labelUrl = checkoutData.label_url || checkoutData.print_url || tagData.label_url || "";
  const tracking = checkoutData.tracking || checkoutData.tracking_number || tagData.tracking || tagId || "";

  return { labelUrl, tracking };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody: PurchaseShippingRequest = await req.json();
    const {
      sale_id,
      shipping_company,
      shipping_source,
      shipping_service_id,
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
      destination_city,
      destination_state,
      destination_street,
      destination_number,
      destination_complement,
      destination_neighborhood,
      seller_name,
      seller_phone,
      seller_document,
      customer_document,
    } = requestBody;

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
      .select("melhor_envio_token, superfrete_token, full_name, phone, cpf")
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

    const purchaseReq: PurchaseShippingRequest = {
      sale_id,
      shipping_company,
      shipping_source,
      shipping_service_id,
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
      destination_city,
      destination_state,
      destination_street,
      destination_number,
      destination_complement,
      destination_neighborhood,
      seller_name: seller_name || profile.full_name || "Vendedor",
      seller_phone: seller_phone || profile.phone || "00000000000",
      seller_document: seller_document || profile.cpf || "00000000000",
      customer_document: customer_document || "00000000000",
    };

    if (
      (source.includes("melhor envio") || source === "melhor envio") &&
      profile.melhor_envio_token
    ) {
      const result = await purchaseShippingMelhorEnvio(purchaseReq, profile.melhor_envio_token);
      labelUrl = result.labelUrl;
      tracking = result.tracking;
    } else if (
      (source.includes("superfrete") || source === "superfrete") &&
      profile.superfrete_token
    ) {
      const result = await purchaseShippingSuperFrete(purchaseReq, profile.superfrete_token);
      labelUrl = result.labelUrl;
      tracking = result.tracking;
    } else if (profile.melhor_envio_token) {
      const result = await purchaseShippingMelhorEnvio(purchaseReq, profile.melhor_envio_token);
      labelUrl = result.labelUrl;
      tracking = result.tracking;
    } else if (profile.superfrete_token) {
      const result = await purchaseShippingSuperFrete(purchaseReq, profile.superfrete_token);
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
