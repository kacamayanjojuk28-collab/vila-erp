BEGIN;
ALTER TABLE "DocumentLine" ADD COLUMN "orgId" TEXT;
UPDATE "DocumentLine" l SET "orgId"=d."orgId" FROM "Document" d WHERE d.id=l."documentId";
ALTER TABLE "DocumentLine" ALTER COLUMN "orgId" SET NOT NULL;
CREATE FUNCTION vila_line_tenant_default() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."orgId" IS NULL THEN SELECT "orgId" INTO NEW."orgId" FROM "Document" WHERE id=NEW."documentId"; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER vila_line_tenant_default BEFORE INSERT ON "DocumentLine" FOR EACH ROW EXECUTE FUNCTION vila_line_tenant_default();
ALTER TABLE "DocumentLine" ADD CONSTRAINT "DocumentLine_document_tenant_fkey" FOREIGN KEY ("orgId","documentId") REFERENCES "Document"("orgId","id") ON DELETE CASCADE;
ALTER TABLE "DocumentLine" ADD CONSTRAINT "DocumentLine_product_tenant_fkey" FOREIGN KEY ("orgId","productId") REFERENCES "Record"("orgId","id") ON DELETE RESTRICT;
CREATE INDEX "DocumentLine_org_document_idx" ON "DocumentLine"("orgId","documentId");
COMMIT;
