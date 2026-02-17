import { supabase } from "@/integrations/supabase/client";

/**
 * Syncs products from the admin's catalog for a specific supplier
 * into the user's inventory with stock_quantity = 0.
 * Idempotent: only inserts products not already present (by name, case-insensitive).
 */
export async function syncSupplierCatalog(
  userId: string,
  userSupplierId: string,
  supplierName: string
): Promise<number> {
  // 1. Find admin user id
  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .single();

  if (!adminRole) throw new Error("Admin não encontrado");
  const adminId = adminRole.user_id;

  // 2. Find admin supplier by name (case-insensitive)
  const { data: adminSuppliers } = await supabase
    .from("suppliers")
    .select("id")
    .eq("owner_id", adminId)
    .ilike("name", supplierName);

  if (!adminSuppliers || adminSuppliers.length === 0) {
    throw new Error(`Fornecedor "${supplierName}" não encontrado no catálogo master`);
  }

  const adminSupplierId = adminSuppliers[0].id;

  // 3. Fetch admin products for this supplier
  const { data: adminProducts } = await supabase
    .from("products")
    .select("name, description, category, price, cost_price, sku, size, color, min_stock_level, image_url, is_active, image_url_2, image_url_3, category_2, category_3, video_url")
    .eq("owner_id", adminId)
    .eq("supplier_id", adminSupplierId)
    .limit(5000);

  if (!adminProducts || adminProducts.length === 0) return 0;

  // 4. Fetch existing user products for this supplier (to avoid duplicates)
  const { data: existingProducts } = await supabase
    .from("products")
    .select("name")
    .eq("owner_id", userId)
    .eq("supplier_id", userSupplierId)
    .limit(5000);

  const existingNames = new Set(
    (existingProducts || []).map((p) => p.name.toLowerCase())
  );

  // 5. Filter new products
  const newProducts = adminProducts.filter(
    (p) => !existingNames.has(p.name.toLowerCase())
  );

  if (newProducts.length === 0) {
    // Mark as synced even if no new products
    await supabase
      .from("suppliers")
      .update({ catalog_synced: true } as any)
      .eq("id", userSupplierId);
    return 0;
  }

  // 6. Insert new products with stock 0
  const toInsert = newProducts.map((p) => ({
    owner_id: userId,
    supplier_id: userSupplierId,
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.price,
    cost_price: p.cost_price,
    sku: p.sku,
    size: p.size,
    color: p.color,
    stock_quantity: 0,
    min_stock_level: p.min_stock_level,
    image_url: p.image_url,
    is_active: p.is_active,
    image_url_2: p.image_url_2,
    image_url_3: p.image_url_3,
    category_2: p.category_2,
    category_3: p.category_3,
    video_url: p.video_url,
  }));

  const { error } = await supabase.from("products").insert(toInsert as any);
  if (error) throw error;

  // 7. Mark supplier as synced
  await supabase
    .from("suppliers")
    .update({ catalog_synced: true } as any)
    .eq("id", userSupplierId);

  return newProducts.length;
}
