import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  name?: string;
}

export interface SaleStoreState {
  customerId: string | null;
  items: SaleItem[];
  paymentMethod: string | null;
  saleDate: string;
  notes: string;
  setCustomerId: (id: string | null) => void;
  addItem: (item: SaleItem) => void;
  removeItem: (productId: string) => void;
  updateItemQuantity: (productId: string, quantity: number) => void;
  setPaymentMethod: (method: string) => void;
  setSaleDate: (date: string) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
}

export const useSaleStore = create<SaleStoreState>()(
  persist(
    (set) => ({
      customerId: null,
      items: [],
      paymentMethod: null,
      saleDate: new Date().toISOString().split('T')[0],
      notes: '',
      setCustomerId: (id) => set({ customerId: id }),
      addItem: (item) => set((state) => {
        const existingItem = state.items.find(i => i.product_id === item.product_id);
        if (existingItem) {
          return {
            items: state.items.map(i => 
              i.product_id === item.product_id 
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            )
          };
        }
        return { items: [...state.items, item] };
      }),
      removeItem: (productId) => set((state) => ({
        items: state.items.filter(i => i.product_id !== productId)
      })),
      updateItemQuantity: (productId, quantity) => set((state) => ({
        items: state.items.map(i => 
          i.product_id === productId 
            ? { ...i, quantity }
            : i
        )
      })),
      setPaymentMethod: (method) => set({ paymentMethod: method }),
      setSaleDate: (date) => set({ saleDate: date }),
      setNotes: (notes) => set({ notes: notes }),
      clearCart: () => set({ 
        customerId: null, 
        items: [], 
        paymentMethod: null, 
        saleDate: new Date().toISOString().split('T')[0], 
        notes: '' 
      }),
    }),
    {
      name: 'vendaprofit-sale-draft-storage',
      // Armazena no sessionStorage, os dados sobem caso a janela/aba seja reiniciada
      // Mas permanecem quando a pessoa usa as setas Voltar/Avançar telas.
      storage: createJSONStorage(() => sessionStorage), 
    }
  )
);
