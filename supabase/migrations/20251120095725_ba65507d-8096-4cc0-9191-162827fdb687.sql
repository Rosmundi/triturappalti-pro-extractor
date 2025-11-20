-- Add cig_appalto and descrizione_appalto to leads table to store work info per lead
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cig_appalto text,
  ADD COLUMN IF NOT EXISTS descrizione_appalto text;