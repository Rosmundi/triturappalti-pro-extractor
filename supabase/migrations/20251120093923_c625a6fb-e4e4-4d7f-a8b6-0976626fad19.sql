-- Create uploads table to track PDF uploads
CREATE TABLE public.uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'processing',
  cig_appalto TEXT,
  descrizione_appalto TEXT
);

-- Create leads table to store extracted leads
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  lead_name TEXT NOT NULL,
  lead_email TEXT,
  lead_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (since no auth is implemented yet)
CREATE POLICY "Allow public read access to uploads" 
ON public.uploads 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert to uploads" 
ON public.uploads 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update to uploads" 
ON public.uploads 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public read access to leads" 
ON public.leads 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert to leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_leads_upload_id ON public.leads(upload_id);