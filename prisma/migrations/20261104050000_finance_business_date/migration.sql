BEGIN;
CREATE OR REPLACE FUNCTION vila_journal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "AccountingPeriod";
BEGIN
 IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND OLD.status='POSTED') THEN RAISE EXCEPTION 'Posted journal immutable' USING ERRCODE='23514'; END IF;
 SELECT * INTO p FROM "AccountingPeriod" WHERE "orgId"=NEW."orgId" AND id=NEW."periodId" FOR SHARE;
 IF p.id IS NULL OR p.status<>'OPEN' OR NEW."effectiveOn" NOT BETWEEN p."startsOn" AND p."endsOn" OR NEW."effectiveOn">(clock_timestamp() AT TIME ZONE 'Europe/Istanbul')::date THEN RAISE EXCEPTION 'Closed/invalid journal period or date' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

COMMIT;
