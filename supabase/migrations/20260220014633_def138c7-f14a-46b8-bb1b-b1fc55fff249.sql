
-- Criar tabela user_subscriptions
CREATE TABLE public.user_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_type text NOT NULL DEFAULT 'trial',
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  product_count_limit integer NULL,
  onboarding_completed boolean NOT NULL DEFAULT false,
  notes text NULL,
  updated_by_admin uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies: usuário vê apenas o próprio registro
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding_completed"
  ON public.user_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admin pode ver e editar todos
CREATE POLICY "Admins can select all subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert subscriptions"
  ON public.user_subscriptions
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all subscriptions"
  ON public.user_subscriptions
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função e trigger para criar trial automaticamente ao criar novo perfil
CREATE OR REPLACE FUNCTION public.create_trial_on_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (
    user_id,
    plan_type,
    status,
    started_at,
    expires_at,
    product_count_limit,
    onboarding_completed
  ) VALUES (
    NEW.id,
    'trial',
    'active',
    now(),
    now() + interval '5 days',
    10,
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_trial_on_new_profile_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_trial_on_new_profile();

-- Migrar usuários existentes para premium_monthly com vencimento no dia 01 do próximo mês
INSERT INTO public.user_subscriptions (
  user_id,
  plan_type,
  status,
  started_at,
  expires_at,
  product_count_limit,
  onboarding_completed
)
SELECT
  id,
  'premium_monthly',
  'active',
  now(),
  date_trunc('month', now()) + interval '2 months',
  NULL,
  true
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;
