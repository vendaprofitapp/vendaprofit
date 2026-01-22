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
            color,
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
            color,
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
            // Skip if same size and color as original
            if (variant.size === product.size && variant.color === product.color) {
              continue;
            }

            const availableStock = await getAvailableStock(p.id, variant.id);
            
            if (availableStock > 0) {
              swapOptions.push({
                id: p.id,
                name: p.name,
                size: variant.size,
                color: variant.color,
                price: p.price,
                availableStock,
                image_url: variant.image_url || p.image_url,
                variant_id: variant.id,
              });
            }
          }
        } else {
          // Product without variants
          if (p.size === product.size && p.color === product.color) {
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
   */
  const findSizeAlternatives = async (
    productId: string,
    currentSize: string | null
  ): Promise<SwapSuggestion[]> => {
    setLoading(true);
    try {
      const { data: product } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          image_url,
          product_variants (
            id,
            size,
            color,
            stock_quantity,
            image_url
          )
        `)
        .eq('id', productId)
        .single();

      if (!product || !product.product_variants) {
        setSuggestions([]);
        return [];
      }

      const alternatives: SwapSuggestion[] = [];

      for (const variant of product.product_variants) {
        if (variant.size === currentSize) continue;

        const availableStock = await getAvailableStock(productId, variant.id);
        
        if (availableStock > 0) {
          alternatives.push({
            id: product.id,
            name: product.name,
            size: variant.size,
            color: variant.color,
            price: product.price,
            availableStock,
            image_url: variant.image_url || product.image_url,
            variant_id: variant.id,
          });
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
   */
  const findColorAlternatives = async (
    productId: string,
    currentSize: string | null,
    currentColor: string | null
  ): Promise<SwapSuggestion[]> => {
    setLoading(true);
    try {
      const { data: product } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          image_url,
          product_variants (
            id,
            size,
            color,
            stock_quantity,
            image_url
          )
        `)
        .eq('id', productId)
        .single();

      if (!product || !product.product_variants) {
        setSuggestions([]);
        return [];
      }

      const alternatives: SwapSuggestion[] = [];

      for (const variant of product.product_variants) {
        // Same size, different color
        if (variant.size === currentSize && variant.color !== currentColor) {
          const availableStock = await getAvailableStock(productId, variant.id);
          
          if (availableStock > 0) {
            alternatives.push({
              id: product.id,
              name: product.name,
              size: variant.size,
              color: variant.color,
              price: product.price,
              availableStock,
              image_url: variant.image_url || product.image_url,
              variant_id: variant.id,
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
