BEGIN;
CREATE FUNCTION vila_account_purpose(tenant text,account_id text) RETURNS text LANGUAGE sql STABLE AS $$
 WITH RECURSIVE ancestry AS (
  SELECT id,"parentId",purpose,ARRAY[id] visited FROM "LedgerAccount" WHERE "orgId"=tenant AND id=account_id
  UNION ALL SELECT p.id,p."parentId",p.purpose,a.visited||p.id FROM "LedgerAccount" p JOIN ancestry a ON p.id=a."parentId" WHERE p."orgId"=tenant AND NOT p.id=ANY(a.visited) AND cardinality(a.visited)<32
 ) SELECT purpose FROM ancestry WHERE purpose IS NOT NULL ORDER BY cardinality(visited) LIMIT 1
$$;
CREATE OR REPLACE FUNCTION vila_journal_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j "JournalEntry"; a "LedgerAccount"; rowdata "JournalLine"; effective_purpose text;
BEGIN
 IF TG_OP='DELETE' THEN rowdata:=OLD; ELSE rowdata:=NEW; END IF;
 SELECT * INTO j FROM "JournalEntry" WHERE "orgId"=rowdata."orgId" AND id=rowdata."entryId" FOR SHARE;
 IF j.status<>'DRAFT' THEN RAISE EXCEPTION 'Journal lines immutable after posting' USING ERRCODE='23514'; END IF;
 IF TG_OP<>'DELETE' THEN
  SELECT * INTO a FROM "LedgerAccount" WHERE "orgId"=NEW."orgId" AND id=NEW."accountId";
  effective_purpose:=vila_account_purpose(NEW."orgId",NEW."accountId");
  IF a.id IS NULL OR NOT a.active THEN RAISE EXCEPTION 'Inactive/missing ledger account' USING ERRCODE='23514'; END IF;
  IF coalesce(effective_purpose IN ('AR','AP','CUSTOMER_ADVANCE','SUPPLIER_ADVANCE'),false)<>(NEW."partyId" IS NOT NULL) OR (a."partyId" IS NOT NULL AND a."partyId" IS DISTINCT FROM NEW."partyId") THEN RAISE EXCEPTION 'Control subaccount party mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN rowdata;
END $$;
CREATE OR REPLACE FUNCTION vila_account_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."parentId" IS DISTINCT FROM NEW."parentId" OR OLD.purpose IS DISTINCT FROM NEW.purpose THEN RAISE EXCEPTION 'Account hierarchy/purpose immutable; create explicit new account' USING ERRCODE='23514'; END IF;
 IF (OLD.code<>NEW.code OR OLD.category<>NEW.category OR OLD."partyId" IS DISTINCT FROM NEW."partyId") AND EXISTS(SELECT 1 FROM "JournalLine" WHERE "orgId"=OLD."orgId" AND "accountId"=OLD.id) THEN RAISE EXCEPTION 'Used account identity immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
COMMIT;
