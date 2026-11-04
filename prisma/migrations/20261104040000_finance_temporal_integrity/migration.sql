BEGIN;
CREATE OR REPLACE FUNCTION vila_invoice_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE i "FinancialInvoice"; t "TaxRule"; source_line "InvoiceLine";
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Invoice line snapshot immutable' USING ERRCODE='23514'; END IF;
 SELECT * INTO i FROM "FinancialInvoice" WHERE "orgId"=NEW."orgId" AND id=NEW."invoiceId" FOR SHARE;
 SELECT * INTO t FROM "TaxRule" WHERE "orgId"=NEW."orgId" AND id=NEW."taxRuleId";
 IF i.status<>'DRAFT' OR t.id IS NULL OR NEW."taxRate"<>t.rate OR NEW."taxClassification"<>t.classification THEN RAISE EXCEPTION 'Invalid invoice tax snapshot/state' USING ERRCODE='23514'; END IF;
 IF i."originalId" IS NULL THEN
  IF i."issuedOn" NOT BETWEEN t."validFrom" AND t."validTo" THEN RAISE EXCEPTION 'Tax rule date invalid' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT * INTO source_line FROM "InvoiceLine" WHERE "orgId"=NEW."orgId" AND "invoiceId"=i."originalId" AND id=NEW."originalLineId";
  IF source_line.id IS NULL OR NEW."taxRuleId"<>source_line."taxRuleId" THEN RAISE EXCEPTION 'Credit must retain original tax snapshot' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION vila_finance_timeline_final() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payment_id text; invoice_id text; org_id text; p "FinancePayment"; inv "FinancialInvoice"; j "JournalEntry"; max_date date;
BEGIN
 org_id:=NEW."orgId";
 IF TG_TABLE_NAME='PaymentAllocation' THEN payment_id:=NEW."paymentId"; invoice_id:=NEW."invoiceId";
 ELSIF TG_TABLE_NAME='FinancialInvoice' THEN
  SELECT * INTO inv FROM "FinancialInvoice" WHERE "orgId"=org_id AND id=NEW.id;
  IF inv.status<>'POSTED' THEN RETURN NULL; END IF;
  SELECT * INTO j FROM "JournalEntry" WHERE "orgId"=org_id AND id=inv."journalId";
  IF j."sourceType"<>'INVOICE' OR j."sourceId"<>inv.id OR j."effectiveOn"<>inv."issuedOn" THEN RAISE EXCEPTION 'Invoice journal source/date mismatch' USING ERRCODE='23514'; END IF;
  invoice_id:=coalesce(inv."originalId",inv.id);
 ELSIF TG_TABLE_NAME='FinancePayment' THEN
  SELECT * INTO p FROM "FinancePayment" WHERE "orgId"=org_id AND id=NEW.id;
  SELECT * INTO j FROM "JournalEntry" WHERE "orgId"=org_id AND id=p."journalId";
  IF j."sourceType"<>'PAYMENT' OR j."sourceId"<>p.id OR j."effectiveOn"<>p."effectiveOn" THEN RAISE EXCEPTION 'Payment journal source/date mismatch' USING ERRCODE='23514'; END IF;
  IF p."reversalOf" IS NOT NULL THEN
   SELECT max("effectiveOn") INTO max_date FROM "PaymentAllocation" WHERE "orgId"=org_id AND "paymentId"=p."reversalOf";
   IF p."effectiveOn"<max_date THEN RAISE EXCEPTION 'Payment reversal precedes allocation history' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;
 IF payment_id IS NOT NULL THEN
  SELECT * INTO p FROM "FinancePayment" WHERE "orgId"=org_id AND id=payment_id;
  IF EXISTS(SELECT 1 FROM (SELECT sum(sum(amount)) OVER(ORDER BY "effectiveOn") used FROM "PaymentAllocation" WHERE "orgId"=org_id AND "paymentId"=payment_id GROUP BY "effectiveOn") x WHERE used<0 OR used>p.amount) THEN RAISE EXCEPTION 'Historical payment over-allocation' USING ERRCODE='23514'; END IF;
 END IF;
 IF invoice_id IS NOT NULL THEN
  SELECT * INTO inv FROM "FinancialInvoice" WHERE "orgId"=org_id AND id=invoice_id;
  IF EXISTS(WITH events AS (
   SELECT "effectiveOn" AS event_date,amount FROM "PaymentAllocation" WHERE "orgId"=org_id AND "invoiceId"=invoice_id
   UNION ALL SELECT "issuedOn",total FROM "FinancialInvoice" WHERE "orgId"=org_id AND "originalId"=invoice_id AND status='POSTED'
  ) SELECT 1 FROM (SELECT sum(sum(amount)) OVER(ORDER BY event_date) used FROM events GROUP BY event_date) x WHERE used<0 OR used>inv.total) THEN RAISE EXCEPTION 'Historical invoice over-settlement' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_timeline_final AFTER INSERT ON "PaymentAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vila_finance_timeline_final();
CREATE CONSTRAINT TRIGGER finance_timeline_final AFTER INSERT OR UPDATE ON "FinancialInvoice" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vila_finance_timeline_final();
CREATE CONSTRAINT TRIGGER finance_timeline_final AFTER INSERT ON "FinancePayment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vila_finance_timeline_final();
COMMIT;
