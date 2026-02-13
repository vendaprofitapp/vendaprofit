
-- Add installment columns to expenses
ALTER TABLE public.expenses
ADD COLUMN is_installment boolean NOT NULL DEFAULT false,
ADD COLUMN installment_count integer;

-- Create expense_installments table
CREATE TABLE public.expense_installments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_installments ENABLE ROW LEVEL SECURITY;

-- RLS policies based on expense owner
CREATE POLICY "Users can view installments for own expenses"
ON public.expense_installments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.expenses e
  WHERE e.id = expense_installments.expense_id AND e.owner_id = auth.uid()
));

CREATE POLICY "Users can insert installments for own expenses"
ON public.expense_installments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.expenses e
  WHERE e.id = expense_installments.expense_id AND e.owner_id = auth.uid()
));

CREATE POLICY "Users can update installments for own expenses"
ON public.expense_installments FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.expenses e
  WHERE e.id = expense_installments.expense_id AND e.owner_id = auth.uid()
));

CREATE POLICY "Users can delete installments for own expenses"
ON public.expense_installments FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.expenses e
  WHERE e.id = expense_installments.expense_id AND e.owner_id = auth.uid()
));

-- Index for performance
CREATE INDEX idx_expense_installments_expense_id ON public.expense_installments(expense_id);
CREATE INDEX idx_expense_installments_due_date ON public.expense_installments(due_date);
