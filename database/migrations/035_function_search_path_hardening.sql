DO $$
DECLARE
  schema_name text := current_schema();
BEGIN
  EXECUTE format('ALTER FUNCTION %I.reject_audit_mutation() SET search_path = pg_catalog, %I', schema_name, schema_name);
  EXECUTE format('ALTER FUNCTION %I.revoke_sessions_on_account_security_change() SET search_path = pg_catalog, %I', schema_name, schema_name);
END $$;
