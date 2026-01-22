import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  stock_quantity: number;
  product_variants?: Array<{
    id: string;
    stock_quantity: number;
  }>;
}

interface ConsignmentItem {
  product_id: string;
  variant_id: string | null;
  consignments: {
    status: string;
  } | null;
}

/**
 * Calcula o estoque disponível de um produto, subtraindo os itens
 * que estão em bolsas consignadas com status 'active' ou 'awaiting_approval'
 */
export async function getAvailableStock(productId: string, variantId?: string): Promise<number> {
  try {
    // Get the physical stock
    let physicalStock = 0;

    if (variantId) {
      const { data: variant } = await supabase
        .from('product_variants')
        .select('stock_quantity')
        .eq('id', variantId)
        .single();
      
      physicalStock = variant?.stock_quantity || 0;
    } else {
      const { data: product } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single();
      
      physicalStock = product?.stock_quantity || 0;
    }

    // Get count of items in active/awaiting consignments
    const { data: consignmentItems, error } = await supabase
      .from('consignment_items')
      .select(`
        id,
        product_id,
        variant_id,
        consignments!inner (status)
      `)
      .eq('product_id', productId)
      .in('consignments.status', ['active', 'awaiting_approval'])
      .in('status', ['pending', 'active']);

    if (error) {
      console.error('Erro ao buscar itens consignados:', error);
      return physicalStock;
    }

    // Filter by variant if specified
    const reservedItems = variantId
      ? consignmentItems?.filter(item => item.variant_id === variantId) || []
      : consignmentItems?.filter(item => !item.variant_id) || [];

    const reservedCount = reservedItems.length;
    const availableStock = Math.max(0, physicalStock - reservedCount);

    return availableStock;
  } catch (error) {
    console.error('Erro ao calcular estoque disponível:', error);
    return 0;
  }
}

/**
 * Calcula o estoque disponível para múltiplos produtos de uma vez
 * Mais eficiente quando você precisa verificar vários produtos
 */
export async function getAvailableStockBatch(
  productIds: string[]
): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();

  try {
    // Get physical stock for all products
    const { data: products } = await supabase
      .from('products')
      .select('id, stock_quantity')
      .in('id', productIds);

    if (products) {
      products.forEach(p => stockMap.set(p.id, p.stock_quantity));
    }

    // Get all consignment items for these products in active/awaiting consignments
    const { data: consignmentItems } = await supabase
      .from('consignment_items')
      .select(`
        product_id,
        consignments!inner (status)
      `)
      .in('product_id', productIds)
      .in('consignments.status', ['active', 'awaiting_approval'])
      .in('status', ['pending', 'active']);

    if (consignmentItems) {
      // Count reserved items per product
      const reservedCount = new Map<string, number>();
      consignmentItems.forEach(item => {
        const current = reservedCount.get(item.product_id) || 0;
        reservedCount.set(item.product_id, current + 1);
      });

      // Subtract reserved from physical stock
      reservedCount.forEach((reserved, productId) => {
        const physical = stockMap.get(productId) || 0;
        stockMap.set(productId, Math.max(0, physical - reserved));
      });
    }

    return stockMap;
  } catch (error) {
    console.error('Erro ao calcular estoque em lote:', error);
    return stockMap;
  }
}

/**
 * Verifica se um produto/variante está disponível para consignação
 */
export async function isAvailableForConsignment(
  productId: string,
  variantId?: string
): Promise<boolean> {
  const availableStock = await getAvailableStock(productId, variantId);
  return availableStock > 0;
}

/**
 * Retorna informações sobre itens reservados em consignações
 */
export async function getReservedItemsInfo(productId: string) {
  try {
    const { data, error } = await supabase
      .from('consignment_items')
      .select(`
        id,
        status,
        variant_id,
        consignments!inner (
          id,
          status,
          customers (name)
        )
      `)
      .eq('product_id', productId)
      .in('consignments.status', ['active', 'awaiting_approval'])
      .in('status', ['pending', 'active']);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Erro ao buscar itens reservados:', error);
    return [];
  }
}
