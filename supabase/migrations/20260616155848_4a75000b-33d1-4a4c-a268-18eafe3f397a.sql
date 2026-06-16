ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS nome_appalto text,
  ADD COLUMN IF NOT EXISTS categoria_progetto text,
  ADD COLUMN IF NOT EXISTS tipo_intervento text,
  ADD COLUMN IF NOT EXISTS committente_tipo text,
  ADD COLUMN IF NOT EXISTS categorie_og text,
  ADD COLUMN IF NOT EXISTS procedura_gara text,
  ADD COLUMN IF NOT EXISTS finanziamento text,
  ADD COLUMN IF NOT EXISTS data_appalto text,
  ADD COLUMN IF NOT EXISTS data_fine_lavori text,
  ADD COLUMN IF NOT EXISTS termine_offerta text,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS note_appalto text;