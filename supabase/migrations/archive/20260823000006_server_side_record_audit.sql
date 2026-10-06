-- Server-side, append-only audit records. No client data is trusted.
CREATE OR REPLACE FUNCTION public.audit_record_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id text := COALESCE(auth.uid()::text, 'system');
  v_actor_name text := 'Hệ thống';
  v_record_id bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN v_record_id := OLD.id; ELSE v_record_id := NEW.id; END IF;
  SELECT name INTO v_actor_name FROM public.staff WHERE auth_user_id = auth.uid() LIMIT 1;
  v_actor_name := COALESCE(v_actor_name, CASE WHEN auth.role() = 'service_role' THEN 'Dịch vụ hệ thống' ELSE 'Người dùng đã xác thực' END);
  INSERT INTO public.auditlogs (id, "userId", "userName", action, details, timestamp)
  VALUES (gen_random_uuid()::text, v_actor_id, v_actor_name,
    'Hồ sơ ' || TG_OP,
    'Thao tác ' || TG_OP || ' trên hồ sơ #' || v_record_id::text,
    NOW());
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_record_change ON public.records;
CREATE TRIGGER trigger_audit_record_change
AFTER INSERT OR UPDATE OR DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.audit_record_change();

CREATE OR REPLACE FUNCTION public.audit_configuration_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor text := COALESCE(auth.uid()::text, 'system'); v_id text;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN COALESCE(to_jsonb(OLD)->>'id', 'unknown') ELSE COALESCE(to_jsonb(NEW)->>'id', 'unknown') END;
  INSERT INTO public.auditlogs (id, "userId", "userName", action, details, timestamp)
  VALUES (gen_random_uuid()::text, v_actor, COALESCE(public.get_my_role(), 'Hệ thống'),
          TG_TABLE_NAME || ' ' || TG_OP, 'Thao tác ' || TG_OP || ' trên ' || TG_TABLE_NAME || ' #' || v_id, NOW());
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_policies_change ON public.policies;
CREATE TRIGGER trigger_audit_policies_change AFTER INSERT OR UPDATE OR DELETE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.audit_configuration_change();
DROP TRIGGER IF EXISTS trigger_audit_settings_change ON public.settings;
CREATE TRIGGER trigger_audit_settings_change AFTER INSERT OR UPDATE OR DELETE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.audit_configuration_change();

NOTIFY pgrst, 'reload schema';
