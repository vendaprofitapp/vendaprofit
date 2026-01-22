import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddToWaitlistData {
  product_id: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
}

export function useWaitlist() {
  const [loading, setLoading] = useState(false);

  const addToWaitlist = async (data: AddToWaitlistData) => {
    if (!data.customer_id && !data.customer_phone && !data.customer_name) {
      toast.error('Informe pelo menos um dado do cliente');
      return null;
    }

    setLoading(true);
    try {
      // Check if customer is already on waitlist for this product
      let query = supabase
        .from('product_waitlist')
        .select('id')
        .eq('product_id', data.product_id)
        .eq('status', 'waiting');

      if (data.customer_id) {
        query = query.eq('customer_id', data.customer_id);
      } else if (data.customer_phone) {
        query = query.eq('customer_phone', data.customer_phone);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        toast.info('Cliente já está na fila de espera deste produto');
        return existing;
      }

      const { data: waitlistItem, error } = await supabase
        .from('product_waitlist')
        .insert({
          product_id: data.product_id,
          customer_id: data.customer_id || null,
          customer_name: data.customer_name || null,
          customer_phone: data.customer_phone || null,
          status: 'waiting',
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Cliente adicionado à fila de espera');
      return waitlistItem;
    } catch (error: any) {
      console.error('Erro ao adicionar à fila:', error);
      toast.error('Erro ao adicionar à fila de espera');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getWaitlistCount = async (productId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('product_waitlist')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId)
        .eq('status', 'waiting');

      if (error) throw error;
      return count || 0;
    } catch (error: any) {
      console.error('Erro ao contar fila:', error);
      return 0;
    }
  };

  const getWaitlist = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_waitlist')
        .select(`
          *,
          customers (*)
        `)
        .eq('product_id', productId)
        .eq('status', 'waiting')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Erro ao buscar fila:', error);
      return [];
    }
  };

  const notifyCustomer = async (waitlistItemId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('product_waitlist')
        .update({ status: 'notified' })
        .eq('id', waitlistItemId);

      if (error) throw error;

      toast.success('Cliente marcado como notificado');
      return true;
    } catch (error: any) {
      console.error('Erro ao notificar:', error);
      toast.error('Erro ao atualizar status');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const convertWaitlistItem = async (waitlistItemId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('product_waitlist')
        .update({ status: 'converted' })
        .eq('id', waitlistItemId);

      if (error) throw error;

      toast.success('Cliente convertido com sucesso');
      return true;
    } catch (error: any) {
      console.error('Erro ao converter:', error);
      toast.error('Erro ao converter cliente');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const cancelWaitlistItem = async (waitlistItemId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('product_waitlist')
        .update({ status: 'cancelled' })
        .eq('id', waitlistItemId);

      if (error) throw error;

      toast.success('Item removido da fila');
      return true;
    } catch (error: any) {
      console.error('Erro ao cancelar:', error);
      toast.error('Erro ao remover da fila');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeFromWaitlist = async (waitlistItemId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('product_waitlist')
        .delete()
        .eq('id', waitlistItemId);

      if (error) throw error;

      toast.success('Removido da fila de espera');
      return true;
    } catch (error: any) {
      console.error('Erro ao remover:', error);
      toast.error('Erro ao remover da fila');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    addToWaitlist,
    getWaitlistCount,
    getWaitlist,
    notifyCustomer,
    convertWaitlistItem,
    cancelWaitlistItem,
    removeFromWaitlist,
  };
}
