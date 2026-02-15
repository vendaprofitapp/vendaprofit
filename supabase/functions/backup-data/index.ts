import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES_BY_OWNER = [
  "products",
  "product_variants",
  "colors",
  "sales",
  "sale_items",
  "customers",
  "expenses",
  "expense_splits",
  "expense_installments",
  "financial_splits",
  "suppliers",
  "customer_orders",
  "consignments",
  "consignment_items",
  "consortiums",
  "consortium_participants",
  "consortium_payments",
  "consortium_drawings",
  "consortium_winners",
  "consortium_items",
  "consortium_settings",
  "groups",
  "group_members",
  "partnership_rules",
  "partnership_auto_share",
  "product_partnerships",
  "store_settings",
  "store_leads",
  "store_partnerships",
  "lead_cart_items",
  "marketing_tasks",
  "ad_campaigns",
  "user_ad_integrations",
  "custom_payment_methods",
  "payment_fees",
  "payment_reminders",
  "product_waitlist",
  "waitlist_notifications",
  "stock_requests",
];

// Tables that use user_id instead of owner_id
const USER_ID_TABLES = [
  "customer_orders",
  "group_members",
  "expense_splits",
  "financial_splits",
  "partnership_auto_share",
];

// Tables that need join-based filtering (no direct owner_id/user_id)
const JOIN_TABLES = [
  "sale_items",
  "consignment_items",
  "consortium_participants",
  "consortium_payments",
  "consortium_drawings",
  "consortium_winners",
  "consortium_items",
  "consortium_settings",
  "partnership_rules",
  "store_partnerships",
  "store_leads",
  "lead_cart_items",
  "product_partnerships",
  "product_variants",
  "payment_fees",
  "product_waitlist",
  "waitlist_notifications",
  "stock_requests",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "download";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get all profiles
    const { data: profiles, error: profilesErr } = await admin
      .from("profiles")
      .select("id, full_name, email");

    if (profilesErr) throw new Error(`Profiles error: ${profilesErr.message}`);

    const backupData: any = {
      backup_date: new Date().toISOString(),
      total_users: profiles?.length || 0,
      users: [],
    };

    // For each user, fetch their data from all tables
    for (const profile of profiles || []) {
      const userData: any = {};

      for (const table of TABLES_BY_OWNER) {
        // Skip join tables - fetch them all at once per table
        if (JOIN_TABLES.includes(table)) continue;

        const col = USER_ID_TABLES.includes(table) ? "user_id" : "owner_id";
        
        // Special case: profiles table uses id
        if (table === "profiles") {
          userData[table] = [profile];
          continue;
        }

        const { data, error } = await admin
          .from(table)
          .select("*")
          .eq(col, profile.id);

        if (!error && data) {
          userData[table] = data;
        }
      }

      backupData.users.push({
        user_id: profile.id,
        user_name: profile.full_name,
        user_email: profile.email,
        data: userData,
      });
    }

    // Fetch join tables globally (they'll be included as-is)
    for (const table of JOIN_TABLES) {
      const { data } = await admin.from(table).select("*");
      // Attach to backup root for completeness
      if (!backupData.shared_tables) backupData.shared_tables = {};
      if (data) backupData.shared_tables[table] = data;
    }

    const jsonStr = JSON.stringify(backupData, null, 2);
    const fileSizeKb = Math.round(new TextEncoder().encode(jsonStr).length / 1024);

    // Determine triggering user from auth header
    let triggeredBy: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await admin.auth.getClaims(token);
      if (claimsData?.claims?.sub) {
        triggeredBy = claimsData.claims.sub as string;
      }
    }

    if (mode === "email") {
      // Get admin emails
      const { data: adminRoles } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const adminIds = (adminRoles || []).map((r: any) => r.user_id);

      const { data: adminProfiles } = await admin
        .from("profiles")
        .select("email, full_name")
        .in("id", adminIds);

      const adminEmails = (adminProfiles || []).map((p: any) => p.email);

      if (adminEmails.length === 0) {
        throw new Error("Nenhum admin encontrado para enviar email");
      }

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) throw new Error("RESEND_API_KEY não configurada");

      const today = new Date().toISOString().split("T")[0];

      // Encode JSON as base64 for attachment
      const base64Content = btoa(unescape(encodeURIComponent(jsonStr)));

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "VendaPROFIT Backup <onboarding@resend.dev>",
          to: adminEmails,
          subject: `Backup VendaPROFIT - ${today}`,
          html: `<h2>Backup Diário - VendaPROFIT</h2>
            <p>Segue em anexo o backup completo do sistema.</p>
            <ul>
              <li><strong>Data:</strong> ${today}</li>
              <li><strong>Usuários:</strong> ${backupData.total_users}</li>
              <li><strong>Tamanho:</strong> ${fileSizeKb} KB</li>
            </ul>
            <p>Este é um email automático enviado diariamente às 00:00 (horário de Brasília).</p>`,
          attachments: [
            {
              filename: `backup_vendaprofit_${today}.json`,
              content: base64Content,
            },
          ],
        }),
      });

      if (!emailRes.ok) {
        const errBody = await emailRes.text();
        throw new Error(`Resend error: ${errBody}`);
      }

      // Log success
      await admin.from("backup_logs").insert({
        backup_type: triggeredBy ? "manual" : "scheduled",
        status: "success",
        file_size_kb: fileSizeKb,
        users_count: backupData.total_users,
        triggered_by: triggeredBy,
      });

      return new Response(JSON.stringify({ success: true, message: "Email enviado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download mode
    // Log success
    if (triggeredBy) {
      await admin.from("backup_logs").insert({
        backup_type: "manual",
        status: "success",
        file_size_kb: fileSizeKb,
        users_count: backupData.total_users,
        triggered_by: triggeredBy,
      });
    }

    const today = new Date().toISOString().split("T")[0];
    return new Response(jsonStr, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup_vendaprofit_${today}.json"`,
      },
    });
  } catch (error) {
    console.error("Backup error:", error);

    // Try to log failure
    try {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      await admin.from("backup_logs").insert({
        backup_type: "manual",
        status: "failed",
        error_message: (error as Error).message,
      });
    } catch (_) {
      // ignore logging errors
    }

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
