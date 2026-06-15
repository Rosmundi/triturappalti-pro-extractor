GRANT ALL ON public.uploads TO service_role, authenticated, anon;
GRANT ALL ON public.leads TO service_role, authenticated, anon;
NOTIFY pgrst, 'reload schema';