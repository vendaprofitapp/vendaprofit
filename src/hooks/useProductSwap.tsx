import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAvailableStock } from '@/utils/stockHelpers';

interface SwapSuggestion {
  id: string;
  name: string;
  size: string | null;
  color: string | null;
  price: number;
  availableStock: number;
  image_url: string | null;
  variant_id?: string;
  isFromPartner?: boolean;
  partnerName?: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  size: string | null;
  color: string | null;
}

export function useProductSwap() {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SwapSuggestion[]>([]);

  /**
   * Busca produtos com mesmo nome/categoria mas tamanhos diferentes e estoque disponível
   */
  const findSwapOptions = async (product: Product): Promise<SwapSuggestion[]> => {
    setLoading(true);
    try {
      // First, try to find products with the same name but different sizes
      const { data: sameNameProducts } = await supabase
        .from('products')
        .select(`
          id,
          name,
          size,
          color,
          price,
          stock_quantity,
          image_url,
          product_variants (
            id,
            size,
            stock_quantity,
            image_url
          )
        `)
        .ilike('name', product.name)
        .neq('id', product.id)
        .eq('is_active', true);

      // Also find products in the same category
      const { data: sameCategoryProducts } = await supabase
        .from('products')
        .select(`
          id,
          name,
          size,
          color,
          price,
          stock_quantity,
          image_url,
          product_variants (
            id,
            size,
            stock_quantity,
            image_url
          )
        `)
        .eq('category', product.category)
        .neq('id', product.id)
        .eq('is_active', true)
        .limit(20);

      const allProducts = [...(sameNameProducts || []), ...(sameCategoryProducts || [])];
      
      // Remove duplicates
      const uniqueProducts = allProducts.filter(
        (p, index, self) => index === self.findIndex(t => t.id === p.id)
      );

      const swapOptions: SwapSuggestion[] = [];

      for (const p of uniqueProducts) {
        // Check if product has variants
        if (p.product_variants && p.product_variants.length > 0) {
          for (const variant of p.product_variants) {
            // Skip if same size as original
            if (variant.size === product.size) {
              continue;
            }

            const availableStock = await getAvailableStock(p.id, variant.id);
            
            if (availableStock > 0) {
              swapOptions.push({
                id: p.id,
                name: p.name,
                size: variant.size,
                color: p.color, // Color now comes from product
                price: p.price,
                availableStock,
                image_url: variant.image_url || p.image_url,
                variant_id: variant.id,
              });
            }
          }
        } else {
          // Product without variants
          if (p.size === product.size) {
            continue;
          }

          const availableStock = await getAvailableStock(p.id);
          
          if (availableStock > 0) {
            swapOptions.push({
              id: p.id,
              name: p.name,
              size: p.size,
              color: p.color,
              price: p.price,
              availableStock,
              image_url: p.image_url,
            });
          }
        }
      }

      // Sort by relevance (same name first, then by available stock)
      const sorted = swapOptions.sort((a, b) => {
        const aIsExactName = a.name.toLowerCase() === product.name.toLowerCase();
        const bIsExactName = b.name.toLowerCase() === product.name.toLowerCase();
        
        if (aIsExactName && !bIsExactName) return -1;
        if (!aIsExactName && bIsExactName) return 1;
        
        return b.availableStock - a.availableStock;
      });

      setSuggestions(sorted.slice(0, 10)); // Limit to 10 suggestions
      return sorted.slice(0, 10);
    } catch (error) {
      console.error('Erro ao buscar opções de troca:', error);
      setSuggestions([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Busca opções de tamanho diferente para o mesmo produto
   * Primeiro busca no estoque do vendedor, depois em parceiros/grupos
   */
  const findSizeAlternatives = async (
    productId: string,
    currentSize: string | null,
    currentColor: string | null,
    sellerId?: string
  ): Promise<SwapSuggestion[]> => {
    setLoading(true);
    try {
      // Get original product info first
      const { data: originalProduct, error: productError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          image_url,
          owner_id,
          color,
          product_variants (
            id,
            size,
            stock_quantity,
            image_url
          )
        `)
        .eq('id', productId)
        .single();

      if (productError) {
        console.error('Erro ao buscar produto original:', productError);
        setSuggestions([]);
        return [];
      }

      if (!originalProduct) {
        setSuggestions([]);
        return [];
      }

      const alternatives: SwapSuggestion[] = [];
      const normalizedCurrentSize = (currentSize || "").trim().toLowerCase();
      const ownerId = sellerId || originalProduct.owner_id;

      // 1. First, check variants of the same product
      if (originalProduct.product_variants && originalProduct.product_variants.length > 0) {
        for (const variant of originalProduct.product_variants) {
          const normalizedVariantSize = (variant.size || "").trim().toLowerCase();

          // Skip if same size
          if (normalizedVariantSize === normalizedCurrentSize) continue;

          // Use stock_quantity directly (works without auth)
          if (variant.stock_quantity > 0) {
            alternatives.push({
              id: originalProduct.id,
              name: originalProduct.name,
              size: variant.size,
              color: originalProduct.color, // Color from product
              price: originalProduct.price,
              availableStock: variant.stock_quantity,
              image_url: variant.image_url || originalProduct.image_url,
              variant_id: variant.id,
            });
          }
        }
      }

      // 2. If no alternatives, search in partner products with the same name
      if (alternatives.length === 0) {
        const { data: partnerProducts, error: partnerError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            price,
            image_url,
            owner_id,
            color,
            profiles:owner_id (full_name),
            product_variants (
              id,
              size,
              stock_quantity,
              image_url
            )
          `)
          .ilike('name', originalProduct.name)
          .neq('owner_id', ownerId)
          .eq('is_active', true);

        if (partnerError) {
          console.error('Erro ao buscar produtos de parceiros:', partnerError);
        } else if (partnerProducts && partnerProducts.length > 0) {
          for (const p of partnerProducts) {
            const partnerName = (p.profiles as any)?.full_name || 'Parceiro';
            
            if (p.product_variants && p.product_variants.length > 0) {
              for (const variant of p.product_variants) {
                const normalizedVariantSize = (variant.size || "").trim().toLowerCase();

                // Skip if same size as current
                if (normalizedVariantSize === normalizedCurrentSize) continue;

                if (variant.stock_quantity > 0) {
                  alternatives.push({
                    id: p.id,
                    name: p.name,
                    size: variant.size,
                    color: p.color,
                    price: p.price,
                    availableStock: variant.stock_quantity,
                    image_url: variant.image_url || p.image_url,
                    variant_id: variant.id,
                    isFromPartner: true,
                    partnerName,
                  });
                }
              }
            }
          }
        }
      }

      setSuggestions(alternatives);
      return alternatives;
    } catch (error) {
      console.error('Erro ao buscar alternativas de tamanho:', error);
      setSuggestions([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Busca opções de cor diferente para o mesmo produto e tamanho
   * Note: With the new structure, color is at product level, so this finds
   * different products with similar names but different colors
   */
  const findColorAlternatives = async (
    productId: string,
    currentSize: string | null,
    currentColor: string | null
  ): Promise<SwapSuggestion[]> => {
    setLoading(true);
    try {
      // Get original product
      const { data: product } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          image_url,
          color,
          model,
          owner_id
        `)
        .eq('id', productId)
        .single();

      if (!product) {
        setSuggestions([]);
        return [];
      }

      // Find products with same model but different color
      const alternatives: SwapSuggestion[] = [];
      
      // Search for products with same model (if model exists)
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          image_url,
          color,
          stock_quantity,
          product_variants (
            id,
            size,
            stock_quantity,
            image_url
          )
        `)
        .neq('id', productId)
        .eq('owner_id', product.owner_id)
        .eq('is_active', true);

      if (product.model) {
        query = query.eq('model', product.model);
      } else {
        // Fallback to name-based search
        query = query.ilike('name', `%${product.name.split(' ')[0]}%`);
      }

      const { data: similarProducts } = await query;

      if (similarProducts) {
        for (const p of similarProducts) {
          // Skip if same color
          if (p.color === currentColor) continue;

          // Find variant with same size if specified
          if (currentSize && p.product_variants && p.product_variants.length > 0) {
            const matchingVariant = p.product_variants.find(
              v => v.size?.toLowerCase() === currentSize.toLowerCase()
            );
            
            if (matchingVariant && matchingVariant.stock_quantity > 0) {
              alternatives.push({
                id: p.id,
                name: p.name,
                size: matchingVariant.size,
                color: p.color,
                price: p.price,
                availableStock: matchingVariant.stock_quantity,
                image_url: matchingVariant.image_url || p.image_url,
                variant_id: matchingVariant.id,
              });
            }
          } else if (p.stock_quantity > 0) {
            alternatives.push({
              id: p.id,
              name: p.name,
              size: p.product_variants?.[0]?.size || null,
              color: p.color,
              price: p.price,
              availableStock: p.stock_quantity,
              image_url: p.image_url,
            });
          }
        }
      }

      setSuggestions(alternatives);
      return alternatives;
    } catch (error) {
      console.error('Erro ao buscar alternativas de cor:', error);
      setSuggestions([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const clearSuggestions = () => {
    setSuggestions([]);
  };

  return {
    loading,
    suggestions,
    findSwapOptions,
    findSizeAlternatives,
    findColorAlternatives,
    clearSuggestions,
  };
}
