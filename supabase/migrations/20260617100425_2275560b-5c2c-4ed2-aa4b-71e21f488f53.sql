CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (true) WITH CHECK (true);
GRANT UPDATE ON public.leads TO anon, authenticated;