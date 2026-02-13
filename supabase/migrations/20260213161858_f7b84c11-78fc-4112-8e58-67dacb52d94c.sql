
-- Create expenses table
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT '',
  category_type text NOT NULL DEFAULT 'other',
  description text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_day integer,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  split_mode text NOT NULL DEFAULT 'none',
  custom_split_percent numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create expense_splits table
CREATE TABLE public.expense_splits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;

-- RLS for expenses: owner can CRUD
CREATE POLICY "Users can view own expenses"
  ON public.expenses FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own expenses"
  ON public.expenses FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own expenses"
  ON public.expenses FOR DELETE
  USING (owner_id = auth.uid());

-- RLS for expense_splits: user can see their own splits OR splits from expenses they own
CREATE POLICY "Users can view own splits"
  ON public.expense_splits FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert splits for own expenses"
  ON public.expense_splits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update splits they are involved in"
  ON public.expense_splits FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete splits for own expenses"
  ON public.expense_splits FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_splits.expense_id AND e.owner_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_expenses_owner_id ON public.expenses(owner_id);
CREATE INDEX idx_expenses_expense_date ON public.expenses(expense_date);
CREATE INDEX idx_expenses_group_id ON public.expenses(group_id);
CREATE INDEX idx_expense_splits_expense_id ON public.expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user_id ON public.expense_splits(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
