-- Adicionar coluna de dia de vencimento para cada participante
ALTER TABLE public.consortium_participants 
ADD COLUMN payment_due_day integer DEFAULT 10 CHECK (payment_due_day >= 1 AND payment_due_day <= 31);

-- Adicionar coluna de data de vencimento em cada pagamento
ALTER TABLE public.consortium_payments
ADD COLUMN due_date date;