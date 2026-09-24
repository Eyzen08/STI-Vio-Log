-- STI Vio-Log uses direct PostgreSQL connections from Express. The Supabase
-- Data API is not an application entry point, so public API roles receive no
-- schema/object authority. The Dashboard Data API integration must also be
-- disabled by the project owner.
DO $$
DECLARE role_name TEXT; target_schema TEXT := current_schema();
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM %I', target_schema, role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', target_schema, role_name);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %I', target_schema, role_name);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM %I', target_schema, role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM %I', target_schema, role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM %I', target_schema, role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE EXECUTE ON FUNCTIONS FROM %I', target_schema, role_name);
    END IF;
  END LOOP;
END $$;

DO $$ BEGIN
  EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', current_schema());
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', current_schema());
END $$;

DO $$
DECLARE table_name TEXT; target_schema TEXT := current_schema();
BEGIN
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname=target_schema LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', target_schema, table_name);
  END LOOP;
END $$;

DO $$
DECLARE target_schema TEXT := current_schema(); audit_table TEXT;
BEGIN
  FOREACH audit_table IN ARRAY ARRAY['audit_logs','administrative_security_events'] LOOP
    IF to_regclass(format('%I.%I',target_schema,audit_table)) IS NOT NULL
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sti_vio_log_runtime') THEN
      EXECUTE format('REVOKE UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE %I.%I FROM sti_vio_log_runtime',target_schema,audit_table);
      EXECUTE format('GRANT SELECT,INSERT ON TABLE %I.%I TO sti_vio_log_runtime',target_schema,audit_table);
    END IF;
  END LOOP;
END $$;
