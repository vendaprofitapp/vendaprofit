-- Criar tabela de fornecedores
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own suppliers"
  ON public.suppliers FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own suppliers"
  ON public.suppliers FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own suppliers"
  ON public.suppliers FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own suppliers"
  ON public.suppliers FOR DELETE
  USING (owner_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar coluna supplier_id na tabela products
ALTER TABLE public.products ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id);