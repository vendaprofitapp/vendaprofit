-- ============================================================
-- BACKUP: salva todos os dados do grupo antes de deletar
-- ============================================================
CREATE TABLE IF NOT EXISTS public._backup_parceria_camila_isabelle (
  backup_table TEXT,
  backup_data JSONB,
  backed_up_at TIMESTAMPTZ DEFAULT now()
);

-- Backup groups
INSERT INTO public._backup_parceria_camila_isabelle (backup_table, backup_data)
SELECT 'groups', row_to_json(g)::jsonb FROM public.groups g
WHERE g.id = '23198f24-a5ce-4632-88f6-c9cb99fbb3ef';

-- Backup group_members
INSERT INTO public._backup_parceria_camila_isabelle (backup_table, backup_data)
SELECT 'group_members', row_to_json(gm)::jsonb FROM public.group_members gm
WHERE gm.group_id = '23198f24-a5ce-4632-88f6-c9cb99fbb3ef';

-- Backup financial_splits
INSERT INTO public._backup_parceria_camila_isabelle (backup_table, backup_data)
SELECT 'financial_splits', row_to_json(fs)::jsonb FROM public.financial_splits fs
WHERE fs.user_id IN (
  'ede9d818-75b3-435b-a7e2-258e03ac985b',
  '98191e2a-0eb6-4c35-aa19-2f7e1a258a95'
);

-- Backup product_partnerships
INSERT INTO public._backup_parceria_camila_isabelle (backup_table, backup_data)
SELECT 'product_partnerships', row_to_json(pp)::jsonb FROM public.product_partnerships pp
WHERE pp.group_id = '23198f24-a5ce-4632-88f6-c9cb99fbb3ef';

-- Backup partnership_auto_share
INSERT INTO public._backup_parceria_camila_isabelle (backup_table, backup_data)
SELECT 'partnership_auto_share', row_to_json(pas)::jsonb FROM public.partnership_auto_share pas
WHERE pas.group_id = '23198f24-a5ce-4632-88f6-c9cb99fbb3ef';

-- Backup direct_partnership_invites
INSERT INTO public._backup_parceria_camila_isabelle (backup_table, backup_data)
SELECT 'direct_partnership_invites', row_to_json(dpi)::jsonb FROM public.direct_partnership_invites dpi
WHERE dpi.inviter_id IN (
  'ede9d818-75b3-435b-a7e2-258e03ac985b',
  '98191e2a-0eb6-4c35-aa19-2f7e1a258a95'
);

-- ============================================================
-- DELEÇÃO na ordem correta (respeita foreign keys)
-- ============================================================

-- 1. financial_splits (rateios de parceria)
DELETE FROM public.financial_splits
WHERE user_id IN (
  'ede9d818-75b3-435b-a7e2-258e03ac985b',
  '98191e2a-0eb6-4c35-aa19-2f7e1a258a95'
);

-- 2. product_partnerships
DELETE FROM public.product_partnerships
WHERE group_id = '23198f24-a5ce-4632-88f6-c9cb99fbb3ef';

-- 3. partnership_auto_share
DELETE FROM public.partnership_auto_share
WHERE group_id = '23198f24-a5ce-4632-88f6-c9cb99fbb3ef';

-- 4. direct_partnership_invites
DELETE FROM public.direct_partnership_invites
WHERE inviter_id IN (
  'ede9d818-75b3-435b-a7e2-258e03ac985b',
  '98191e2a-0eb6-4c35-aa19-2f7e1a258a95'
)
OR invitee_email IN (
  'isabellegalx1@gmail.com',
  'teamwodbrasil@gmail.com'
);

-- 5. group_members
DELETE FROM public.group_members
WHERE group_id = '23198f24-a5ce-4632-88f6-c9cb99fbb3ef';

-- 6. groups
DELETE FROM public.groups
WHERE id = '23198f24-a5ce-4632-88f6-c9cb99fbb3ef';
