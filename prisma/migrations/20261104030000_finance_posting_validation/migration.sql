BEGIN;
CREATE OR REPLACE FUNCTION vila_finance_source_final() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j "JournalEntry"; old "JournalEntry"; p "FinancePayment"; lp "Payment"; original "FinancePayment"; i "FinancialInvoice"; src "FinancialInvoice"; l "InvoiceLine"; original_line "InvoiceLine"; ordered "DocumentLine"; used numeric; actual numeric;
BEGIN
 IF TG_TABLE_NAME='JournalEntry' THEN
  SELECT * INTO j FROM "JournalEntry" WHERE id=NEW.id;
  IF j."reversalOf" IS NOT NULL THEN
   SELECT * INTO old FROM "JournalEntry" WHERE id=j."reversalOf" AND "orgId"=j."orgId";
   IF old.id IS NULL OR old.status<>'POSTED' OR j."effectiveOn"<old."effectiveOn" OR old."reversalOf" IS NOT NULL OR EXISTS(
    (SELECT "accountId","partyId",sum(debit) d,sum(credit) c FROM "JournalLine" WHERE "orgId"=j."orgId" AND "entryId"=j.id GROUP BY "accountId","partyId" EXCEPT SELECT "accountId","partyId",sum(credit),sum(debit) FROM "JournalLine" WHERE "orgId"=j."orgId" AND "entryId"=old.id GROUP BY "accountId","partyId")
    UNION ALL
    (SELECT "accountId","partyId",sum(credit),sum(debit) FROM "JournalLine" WHERE "orgId"=j."orgId" AND "entryId"=old.id GROUP BY "accountId","partyId" EXCEPT SELECT "accountId","partyId",sum(debit),sum(credit) FROM "JournalLine" WHERE "orgId"=j."orgId" AND "entryId"=j.id GROUP BY "accountId","partyId")
   ) THEN RAISE EXCEPTION 'Invalid journal reversal mirror' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='FinancePayment' THEN
  SELECT * INTO p FROM "FinancePayment" WHERE id=NEW.id;
  SELECT * INTO lp FROM "Payment" WHERE id=p.id AND "orgId"=p."orgId";
  IF lp.id IS NULL OR lp.amount<>p.amount OR lp.direction<>p.direction OR lp."reversalOf" IS DISTINCT FROM p."reversalOf" OR lp."documentId" IS NOT NULL THEN RAISE EXCEPTION 'Legacy payment/core source mismatch' USING ERRCODE='23514'; END IF;
  IF p."reversalOf" IS NOT NULL THEN
   SELECT * INTO original FROM "FinancePayment" WHERE id=p."reversalOf" AND "orgId"=p."orgId";
   SELECT coalesce(sum(amount),0) INTO used FROM "PaymentAllocation" WHERE "orgId"=p."orgId" AND "paymentId"=original.id;
   IF original.id IS NULL OR original."reversalOf" IS NOT NULL OR used<>0 OR p.amount<>original.amount OR p.direction=original.direction OR p."partyId"<>original."partyId" OR p."effectiveOn"<original."effectiveOn" THEN RAISE EXCEPTION 'Invalid payment reversal source' USING ERRCODE='23514'; END IF;
  END IF;
  SELECT coalesce(sum(jl.debit-jl.credit),0) INTO actual FROM "JournalLine" jl WHERE jl."orgId"=p."orgId" AND jl."entryId"=p."journalId" AND jl."accountId"=p."accountId";
  IF actual<>(CASE WHEN p.direction='IN' THEN p.amount ELSE -p.amount END) THEN RAISE EXCEPTION 'Payment cash journal mismatch' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='FinancialInvoice' THEN
  SELECT * INTO i FROM "FinancialInvoice" WHERE id=NEW.id;
  IF i.status<>'POSTED' THEN RETURN NULL; END IF;
  SELECT coalesce(sum(jl.debit-jl.credit),0) INTO actual FROM "JournalLine" jl JOIN "LedgerAccount" a ON a.id=jl."accountId" AND a."orgId"=jl."orgId" WHERE jl."orgId"=i."orgId" AND jl."entryId"=i."journalId" AND jl."partyId"=i."partyId" AND a.purpose IN ('AR','AP');
  IF actual<>(CASE WHEN i.kind IN ('SALE','PURCHASE_CREDIT') THEN i.total ELSE -i.total END) THEN RAISE EXCEPTION 'Invoice journal mismatch' USING ERRCODE='23514'; END IF;
  IF i."originalId" IS NOT NULL THEN
   SELECT * INTO src FROM "FinancialInvoice" WHERE id=i."originalId" AND "orgId"=i."orgId";
   SELECT coalesce(sum(total),0) INTO used FROM "FinancialInvoice" WHERE "orgId"=i."orgId" AND "originalId"=src.id AND status='POSTED';
   SELECT used+coalesce(sum(amount),0) INTO used FROM "PaymentAllocation" WHERE "orgId"=i."orgId" AND "invoiceId"=src.id;
   IF src.status<>'POSTED' OR i."partyId"<>src."partyId" OR i."issuedOn"<src."issuedOn" OR used>src.total OR NOT ((src.kind='SALE' AND i.kind='SALES_CREDIT') OR (src.kind='PURCHASE' AND i.kind='PURCHASE_CREDIT')) THEN RAISE EXCEPTION 'Invalid credit note source/limit' USING ERRCODE='23514'; END IF;
  END IF;
  FOR l IN SELECT * FROM "InvoiceLine" WHERE "orgId"=i."orgId" AND "invoiceId"=i.id LOOP
   IF i."originalId" IS NOT NULL THEN
    SELECT * INTO original_line FROM "InvoiceLine" WHERE "orgId"=i."orgId" AND id=l."originalLineId" AND "invoiceId"=i."originalId";
    SELECT coalesce(sum(x.quantity),0) INTO used FROM "InvoiceLine" x JOIN "FinancialInvoice" f ON f.id=x."invoiceId" AND f."orgId"=x."orgId" WHERE x."orgId"=i."orgId" AND x."originalLineId"=original_line.id AND f.status='POSTED';
    IF original_line.id IS NULL OR used>original_line.quantity OR l."unitPrice"<>original_line."unitPrice" OR l."discountRate"<>original_line."discountRate" OR l."taxRuleId"<>original_line."taxRuleId" OR l."accountId"<>original_line."accountId" OR l."sourceLineId" IS DISTINCT FROM original_line."sourceLineId" THEN RAISE EXCEPTION 'Invalid credit line snapshot/quantity' USING ERRCODE='23514'; END IF;
   END IF;
   IF l."sourceLineId" IS NOT NULL THEN
    SELECT * INTO ordered FROM "DocumentLine" WHERE "orgId"=i."orgId" AND id=l."sourceLineId";
    SELECT coalesce(sum(CASE WHEN f.kind IN ('SALES_CREDIT','PURCHASE_CREDIT') THEN -x.quantity ELSE x.quantity END),0) INTO used FROM "InvoiceLine" x JOIN "FinancialInvoice" f ON f.id=x."invoiceId" AND f."orgId"=x."orgId" WHERE x."orgId"=i."orgId" AND x."sourceLineId"=l."sourceLineId" AND f.status='POSTED';
    IF ordered.id IS NULL OR ordered."documentId" IS DISTINCT FROM i."orderId" OR ordered."productId" IS DISTINCT FROM l."productId" OR used<0 OR used>ordered.quantity THEN RAISE EXCEPTION 'Invoiced order quantity/source mismatch' USING ERRCODE='23514'; END IF;
   END IF;
  END LOOP;
 END IF;
 RETURN NULL;
END $$;
COMMIT;
