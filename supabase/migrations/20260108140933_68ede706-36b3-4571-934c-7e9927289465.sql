
-- Criar tabela de consórcios
CREATE TABLE public.consortiums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_value NUMERIC NOT NULL DEFAULT 0,
  installment_value NUMERIC NOT NULL DEFAULT 0,
  installments_count INTEGER NOT NULL DEFAULT 12,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de participantes do consórcio
CREATE TABLE public.consortium_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consortium_id UUID NOT NULL REFERENCES public.consortiums(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  payment_method TEXT NOT NULL DEFAULT 'dinheiro',
  is_drawn BOOLEAN NOT NULL DEFAULT false,
  drawn_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de pagamentos dos participantes
CREATE TABLE public.consortium_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID NOT NULL REFERENCES public.consortium_participants(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de sorteios
CREATE TABLE public.consortium_drawings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consortium_id UUID NOT NULL REFERENCES public.consortiums(id) ON DELETE CASCADE,
  drawing_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de vencedores dos sorteios
CREATE TABLE public.consortium_winners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  drawing_id UUID NOT NULL REFERENCES public.consortium_drawings(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.consortium_participants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de itens enviados para os sorteados (como vendas)
CREATE TABLE public.consortium_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  winner_id UUID NOT NULL REFERENCES public.consortium_winners(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.consortiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_items ENABLE ROW LEVEL SECURITY;

-- Políticas para consortiums
CREATE POLICY "Users can view own consortiums" ON public.consortiums FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own consortiums" ON public.consortiums FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own consortiums" ON public.consortiums FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own consortiums" ON public.consortiums FOR DELETE USING (owner_id = auth.uid());

-- Políticas para consortium_participants (via consortium owner)
CREATE POLICY "Users can view consortium participants" ON public.consortium_participants FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.consortiums c WHERE c.id = consortium_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can insert consortium participants" ON public.consortium_participants FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.consortiums c WHERE c.id = consortium_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can update consortium participants" ON public.consortium_participants FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.consortiums c WHERE c.id = consortium_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can delete consortium participants" ON public.consortium_participants FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.consortiums c WHERE c.id = consortium_id AND c.owner_id = auth.uid()));

-- Políticas para consortium_payments
CREATE POLICY "Users can view consortium payments" ON public.consortium_payments FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.consortium_participants cp JOIN public.consortiums c ON c.id = cp.consortium_id WHERE cp.id = participant_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can insert consortium payments" ON public.consortium_payments FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.consortium_participants cp JOIN public.consortiums c ON c.id = cp.consortium_id WHERE cp.id = participant_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can update consortium payments" ON public.consortium_payments FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.consortium_participants cp JOIN public.consortiums c ON c.id = cp.consortium_id WHERE cp.id = participant_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can delete consortium payments" ON public.consortium_payments FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.consortium_participants cp JOIN public.consortiums c ON c.id = cp.consortium_id WHERE cp.id = participant_id AND c.owner_id = auth.uid()));

-- Políticas para consortium_drawings
CREATE POLICY "Users can view consortium drawings" ON public.consortium_drawings FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.consortiums c WHERE c.id = consortium_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can insert consortium drawings" ON public.consortium_drawings FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.consortiums c WHERE c.id = consortium_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can update consortium drawings" ON public.consortium_drawings FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.consortiums c WHERE c.id = consortium_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can delete consortium drawings" ON public.consortium_drawings FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.consortiums c WHERE c.id = consortium_id AND c.owner_id = auth.uid()));

-- Políticas para consortium_winners
CREATE POLICY "Users can view consortium winners" ON public.consortium_winners FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.consortium_drawings cd JOIN public.consortiums c ON c.id = cd.consortium_id WHERE cd.id = drawing_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can insert consortium winners" ON public.consortium_winners FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.consortium_drawings cd JOIN public.consortiums c ON c.id = cd.consortium_id WHERE cd.id = drawing_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can delete consortium winners" ON public.consortium_winners FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.consortium_drawings cd JOIN public.consortiums c ON c.id = cd.consortium_id WHERE cd.id = drawing_id AND c.owner_id = auth.uid()));

-- Políticas para consortium_items
CREATE POLICY "Users can view consortium items" ON public.consortium_items FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.consortium_winners cw JOIN public.consortium_drawings cd ON cd.id = cw.drawing_id JOIN public.consortiums c ON c.id = cd.consortium_id WHERE cw.id = winner_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can insert consortium items" ON public.consortium_items FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.consortium_winners cw JOIN public.consortium_drawings cd ON cd.id = cw.drawing_id JOIN public.consortiums c ON c.id = cd.consortium_id WHERE cw.id = winner_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can update consortium items" ON public.consortium_items FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.consortium_winners cw JOIN public.consortium_drawings cd ON cd.id = cw.drawing_id JOIN public.consortiums c ON c.id = cd.consortium_id WHERE cw.id = winner_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can delete consortium items" ON public.consortium_items FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.consortium_winners cw JOIN public.consortium_drawings cd ON cd.id = cw.drawing_id JOIN public.consortiums c ON c.id = cd.consortium_id WHERE cw.id = winner_id AND c.owner_id = auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_consortiums_updated_at BEFORE UPDATE ON public.consortiums FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_consortium_participants_updated_at BEFORE UPDATE ON public.consortium_participants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
