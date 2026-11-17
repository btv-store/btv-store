REVOKE ALL ON public.orders FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.orders FROM authenticated;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.user_roles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.products FROM anon, authenticated;
DELETE FROM public.orders WHERE customer_name = 'Teste Seguranca';