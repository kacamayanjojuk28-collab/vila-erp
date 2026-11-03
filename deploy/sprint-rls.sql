-- Candidate policy set, deliberately NOT in the automatic production migration chain.
-- Apply only through the guarded sprint installer until release review is complete.
BEGIN;
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['Record','Document','DocumentLine','Stock','Movement','Payment','Audit','MutationReceipt'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY vila_tenant_guard ON %I USING ("orgId" = nullif(current_setting(''vila.tenant_id'', true), '''')) WITH CHECK ("orgId" = nullif(current_setting(''vila.tenant_id'', true), ''''))', table_name);
  END LOOP;
END $$;
COMMIT;
