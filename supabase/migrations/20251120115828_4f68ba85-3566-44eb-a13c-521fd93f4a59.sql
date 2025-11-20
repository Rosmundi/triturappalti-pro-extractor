-- Add missing columns to leads table to store all n8n data
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS project_id text,
ADD COLUMN IF NOT EXISTS value_eur text,
ADD COLUMN IF NOT EXISTS phase text,
ADD COLUMN IF NOT EXISTS cup text,
ADD COLUMN IF NOT EXISTS appalto_location text,
ADD COLUMN IF NOT EXISTS entity_role text,
ADD COLUMN IF NOT EXISTS lead_kind text,
ADD COLUMN IF NOT EXISTS lead_subtype text,
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS role_title text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS street text,
ADD COLUMN IF NOT EXISTS cap text,
ADD COLUMN IF NOT EXISTS lead_city text,
ADD COLUMN IF NOT EXISTS lead_province text,
ADD COLUMN IF NOT EXISTS lead_region text,
ADD COLUMN IF NOT EXISTS country text;

-- Add delete policy for uploads
CREATE POLICY "Allow public delete to uploads"
ON public.uploads
FOR DELETE
USING (true);

-- Add delete policy for leads
CREATE POLICY "Allow public delete to leads"
ON public.leads
FOR DELETE
USING (true);