-- Add is_direct flag to groups to distinguish direct partnerships from group partnerships
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_direct BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_groups_is_direct ON public.groups(is_direct);

-- Create direct partnership invites table for pending invitations
CREATE TABLE public.direct_partnership_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_id UUID NOT NULL,
  invitee_email TEXT NOT NULL,
  invite_code TEXT NOT NULL DEFAULT substring(md5(random()::text), 1, 8),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(inviter_id, invitee_email)
);

-- Enable RLS
ALTER TABLE public.direct_partnership_invites ENABLE ROW LEVEL SECURITY;

-- Policies for direct_partnership_invites
CREATE POLICY "Users can view invites they sent or received"
  ON public.direct_partnership_invites FOR SELECT
  USING (
    auth.uid() = inviter_id OR 
    invitee_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can create invites"
  ON public.direct_partnership_invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Inviter can update their invites"
  ON public.direct_partnership_invites FOR UPDATE
  USING (auth.uid() = inviter_id);

CREATE POLICY "Invitee can accept or reject invites"
  ON public.direct_partnership_invites FOR UPDATE
  USING (invitee_email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Inviter can delete pending invites"
  ON public.direct_partnership_invites FOR DELETE
  USING (auth.uid() = inviter_id AND status = 'pending');

-- Allow anyone to search invites by invite code (for accepting via code)
CREATE POLICY "Anyone can search by invite code"
  ON public.direct_partnership_invites FOR SELECT
  USING (invite_code IS NOT NULL AND status = 'pending');