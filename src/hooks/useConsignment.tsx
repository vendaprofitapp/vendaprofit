import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface CreateConsignmentData {
  customer_id?: string;
  deadline_at?: string;
  shipping_cost?: number;
}

interface AddItemData {
  consignment_id: string;
  product_id: string;
  variant_id?: string;
  original_price: number;
}

export function useConsignment() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const createConsignment = async (data: CreateConsignmentData) => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return null;
    }

    setLoading(true);
    try {
      const { data: consignment, error } = await supabase
        .from('consignments')
        .insert({
          seller_id: user.id,
          customer_id: data.customer_id || null,
          deadline_at: data.deadline_at || null,
          shipping_cost: data.shipping_cost || null,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Bolsa consignada criada com sucesso');
      return consignment;
    } catch (error: any) {
      console.error('Erro ao criar consignment:', error);
      toast.error('Erro ao criar bolsa consignada');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (data: AddItemData) => {
    setLoading(true);
    try {
      const { data: item, error } = await supabase
        .from('consignment_items')
        .insert({
          consignment_id: data.consignment_id,
          product_id: data.product_id,
          variant_id: data.variant_id || null,
          original_price: data.original_price,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Item adicionado à bolsa');
      return item;
    } catch (error: any) {
      console.error('Erro ao adicionar item:', error);
      toast.error('Erro ao adicionar item');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (itemId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('consignment_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast.success('Item removido da bolsa');
      return true;
    } catch (error: any) {
      console.error('Erro ao remover item:', error);
      toast.error('Erro ao remover item');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const requestApproval = async (consignmentId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('consignments')
        .update({ status: 'awaiting_approval' })
        .eq('id', consignmentId);

      if (error) throw error;

      toast.success('Solicitação de aprovação enviada');
      return true;
    } catch (error: any) {
      console.error('Erro ao solicitar aprovação:', error);
      toast.error('Erro ao solicitar aprovação');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const approveConsignment = async (consignmentId: string) => {
    setLoading(true);
    try {
      // Update consignment status to active and set approved_at
      const { error: consignmentError } = await supabase
        .from('consignments')
        .update({
          status: 'active',
          approved_at: new Date().toISOString(),
        })
        .eq('id', consignmentId);

      if (consignmentError) throw consignmentError;

      // Update all items to active status
      const { error: itemsError } = await supabase
        .from('consignment_items')
        .update({ status: 'active' })
        .eq('consignment_id', consignmentId);

      if (itemsError) throw itemsError;

      toast.success('Bolsa aprovada com sucesso');
      return true;
    } catch (error: any) {
      console.error('Erro ao aprovar bolsa:', error);
      toast.error('Erro ao aprovar bolsa');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const finalizeConsignment = async (consignmentId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('consignments')
        .update({ status: 'finalized_by_client' })
        .eq('id', consignmentId);

      if (error) throw error;

      toast.success('Bolsa finalizada pelo cliente');
      return true;
    } catch (error: any) {
      console.error('Erro ao finalizar bolsa:', error);
      toast.error('Erro ao finalizar bolsa');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const completeConsignment = async (consignmentId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('consignments')
        .update({ status: 'completed' })
        .eq('id', consignmentId);

      if (error) throw error;

      toast.success('Bolsa concluída com sucesso');
      return true;
    } catch (error: any) {
      console.error('Erro ao concluir bolsa:', error);
      toast.error('Erro ao concluir bolsa');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const cancelConsignment = async (consignmentId: string) => {
    setLoading(true);
    try {
      // First, update all items to 'cancelled' status
      // This ensures they are immediately released from virtual stock
      const { error: itemsError } = await supabase
        .from('consignment_items')
        .update({ status: 'cancelled' })
        .eq('consignment_id', consignmentId);

      if (itemsError) {
        console.error('Erro ao cancelar itens:', itemsError);
        // Continue with consignment cancellation even if items fail
      }

      // Then cancel the consignment itself
      const { error } = await supabase
        .from('consignments')
        .update({ status: 'cancelled' })
        .eq('id', consignmentId);

      if (error) throw error;

      toast.success('Bolsa cancelada - produtos voltaram ao estoque');
      return true;
    } catch (error: any) {
      console.error('Erro ao cancelar bolsa:', error);
      toast.error('Erro ao cancelar bolsa');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateItemStatus = async (
    itemId: string,
    status: 'pending' | 'active' | 'kept' | 'returned'
  ) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('consignment_items')
        .update({ status })
        .eq('id', itemId);

      if (error) throw error;

      const statusMessages: Record<string, string> = {
        kept: 'Item marcado como "Vai ficar"',
        returned: 'Item marcado como "Devolvido"',
        pending: 'Item voltou para pendente',
        active: 'Item ativo na bolsa',
      };

      toast.success(statusMessages[status] || 'Status atualizado');
      return true;
    } catch (error: any) {
      console.error('Erro ao atualizar status do item:', error);
      toast.error('Erro ao atualizar status');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getConsignment = async (consignmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('consignments')
        .select(`
          *,
          customers (*),
          consignment_items (
            *,
            products (*)
          )
        `)
        .eq('id', consignmentId)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Erro ao buscar consignment:', error);
      return null;
    }
  };

  const getConsignmentByToken = async (accessToken: string) => {
    try {
      const { data, error } = await supabase
        .from('consignments')
        .select(`
          *,
          customers (*),
          consignment_items (
            *,
            products (*)
          )
        `)
        .eq('access_token', accessToken)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Erro ao buscar consignment por token:', error);
      return null;
    }
  };

  const listConsignments = async (status?: string) => {
    if (!user) return [];

    try {
      let query = supabase
        .from('consignments')
        .select(`
          *,
          customers (*),
          consignment_items (count)
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Erro ao listar consignments:', error);
      return [];
    }
  };

  return {
    loading,
    createConsignment,
    addItem,
    removeItem,
    requestApproval,
    approveConsignment,
    finalizeConsignment,
    completeConsignment,
    cancelConsignment,
    updateItemStatus,
    getConsignment,
    getConsignmentByToken,
    listConsignments,
  };
}
