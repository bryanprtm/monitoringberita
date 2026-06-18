-- Lock down SECURITY DEFINER functions so they aren't callable by anon/authenticated via PostgREST.
-- They remain usable by RLS policies and triggers (postgres role owns them).

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
