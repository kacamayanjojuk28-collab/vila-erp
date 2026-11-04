-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purpose" TEXT,
    "parentId" TEXT,
    "partyId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedBy" TEXT,
    "closedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCounter" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FinanceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "effectiveOn" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reversalOf" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "partyId" TEXT,
    "debit" DECIMAL(18,2) NOT NULL,
    "credit" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialInvoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "issuedOn" DATE NOT NULL,
    "dueOn" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "orderId" TEXT,
    "movementId" TEXT,
    "originalId" TEXT,
    "net" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL,
    "tax" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "journalId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "sourceLineId" TEXT,
    "originalLineId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "discountRate" DECIMAL(5,2) NOT NULL,
    "taxRuleId" TEXT NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "taxClassification" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "net" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL,
    "tax" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePayment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "effectiveOn" DATE NOT NULL,
    "reversalOf" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "effectiveOn" DATE NOT NULL,
    "reversalOf" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "asOf" DATE NOT NULL,
    "knownAt" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL,
    "credit" DECIMAL(18,2) NOT NULL,
    "partyDifference" DECIMAL(18,2) NOT NULL,
    "invoiceDifference" DECIMAL(18,2) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_orgId_id_key" ON "LedgerAccount"("orgId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_orgId_code_key" ON "LedgerAccount"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_orgId_purpose_key" ON "LedgerAccount"("orgId", "purpose");

-- CreateIndex
CREATE INDEX "AccountingPeriod_orgId_startsOn_endsOn_idx" ON "AccountingPeriod"("orgId", "startsOn", "endsOn");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_orgId_id_key" ON "AccountingPeriod"("orgId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCounter_orgId_kind_key" ON "FinanceCounter"("orgId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_orgId_id_key" ON "TaxRule"("orgId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_orgId_code_validFrom_key" ON "TaxRule"("orgId", "code", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversalOf_key" ON "JournalEntry"("reversalOf");

-- CreateIndex
CREATE INDEX "JournalEntry_orgId_effectiveOn_id_idx" ON "JournalEntry"("orgId", "effectiveOn", "id");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_orgId_id_key" ON "JournalEntry"("orgId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_orgId_number_key" ON "JournalEntry"("orgId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_orgId_sourceType_sourceId_key" ON "JournalEntry"("orgId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "JournalLine_orgId_entryId_idx" ON "JournalLine"("orgId", "entryId");

-- CreateIndex
CREATE INDEX "JournalLine_orgId_partyId_accountId_idx" ON "JournalLine"("orgId", "partyId", "accountId");

-- CreateIndex
CREATE INDEX "JournalLine_orgId_accountId_entryId_idx" ON "JournalLine"("orgId", "accountId", "entryId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_orgId_id_key" ON "JournalLine"("orgId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialInvoice_journalId_key" ON "FinancialInvoice"("journalId");

-- CreateIndex
CREATE INDEX "FinancialInvoice_orgId_partyId_issuedOn_idx" ON "FinancialInvoice"("orgId", "partyId", "issuedOn");

-- CreateIndex
CREATE INDEX "FinancialInvoice_orgId_status_dueOn_idx" ON "FinancialInvoice"("orgId", "status", "dueOn");

-- CreateIndex
CREATE INDEX "FinancialInvoice_orgId_originalId_idx" ON "FinancialInvoice"("orgId", "originalId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialInvoice_orgId_id_key" ON "FinancialInvoice"("orgId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialInvoice_orgId_number_key" ON "FinancialInvoice"("orgId", "number");

-- CreateIndex
CREATE INDEX "InvoiceLine_orgId_invoiceId_idx" ON "InvoiceLine"("orgId", "invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLine_orgId_sourceLineId_idx" ON "InvoiceLine"("orgId", "sourceLineId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_orgId_id_key" ON "InvoiceLine"("orgId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayment_journalId_key" ON "FinancePayment"("journalId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayment_reversalOf_key" ON "FinancePayment"("reversalOf");

-- CreateIndex
CREATE INDEX "FinancePayment_orgId_partyId_effectiveOn_idx" ON "FinancePayment"("orgId", "partyId", "effectiveOn");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayment_orgId_id_key" ON "FinancePayment"("orgId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_journalId_key" ON "PaymentAllocation"("journalId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_reversalOf_key" ON "PaymentAllocation"("reversalOf");

-- CreateIndex
CREATE INDEX "PaymentAllocation_orgId_paymentId_effectiveOn_idx" ON "PaymentAllocation"("orgId", "paymentId", "effectiveOn");

-- CreateIndex
CREATE INDEX "PaymentAllocation_orgId_invoiceId_effectiveOn_idx" ON "PaymentAllocation"("orgId", "invoiceId", "effectiveOn");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_orgId_id_key" ON "PaymentAllocation"("orgId", "id");

-- CreateIndex
CREATE INDEX "ReconciliationRecord_orgId_asOf_idx" ON "ReconciliationRecord"("orgId", "asOf");

-- Finance Core: additive only. No legacy payment/document conversion or backfill.
CREATE UNIQUE INDEX "DocumentLine_orgId_id_key" ON "DocumentLine" ("orgId",id);
CREATE UNIQUE INDEX "Movement_orgId_id_key" ON "Movement" ("orgId",id);
CREATE UNIQUE INDEX "Payment_orgId_id_key" ON "Payment" ("orgId",id);
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_org_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE RESTRICT;
ALTER TABLE "LedgerAccount" ENABLE ROW LEVEL SECURITY; ALTER TABLE "LedgerAccount" FORCE ROW LEVEL SECURITY;
CREATE POLICY vila_tenant_guard ON "LedgerAccount" USING ("orgId"=nullif(current_setting('vila.tenant_id',true),'')) WITH CHECK ("orgId"=nullif(current_setting('vila.tenant_id',true),''));
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_org_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE RESTRICT;
ALTER TABLE "AccountingPeriod" ENABLE ROW LEVEL SECURITY; ALTER TABLE "AccountingPeriod" FORCE ROW LEVEL SECURITY;
CREATE POLICY vila_tenant_guard ON "AccountingPeriod" USING ("orgId"=nullif(current_setting('vila.tenant_id',true),'')) WITH CHECK ("orgId"=nullif(current_setting('vila.tenant_id',true),''));
ALTER TABLE "FinanceCounter" ADD CONSTRAINT "FinanceCounter_org_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE RESTRICT;
ALTER TABLE "FinanceCounter" ENABLE ROW LEVEL SECURITY; ALTER TABLE "FinanceCounter" FORCE ROW LEVEL SECURITY;
CREATE POLICY vila_tenant_guard ON "FinanceCounter" USING ("orgId"=nullif(current_setting('vila.tenant_id',true),'')) WITH CHECK ("orgId"=nullif(current_setting('vila.tenant_id',true),''));
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_org_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE RESTRICT;
ALTER TABLE "TaxRule" ENABLE ROW LEVEL SECURITY; ALTER TABLE "TaxRule" FORCE ROW LEVEL SECURITY;
CREATE POLICY vila_tenant_guard ON "TaxRule" USING ("orgId"=nullif(current_setting('vila.tenant_id',true),'')) WITH CHECK ("orgId"=nullif(current_setting('vila.tenant_id',true),''));
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_org_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE RESTRICT;
ALTER TABLE "JournalEntry" ENABLE ROW LEVEL SECURITY; ALTER TABLE "JournalEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY vila_tenant_guard ON "JournalEntry" USING ("orgId"=nullif(current_setting('vila.tenant_id',true),'')) WITH CHECK ("orgId"=nullif(current_setting('vila.tenant_id',true),''));
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_org_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE RESTRICT;
ALTER TABLE "JournalLine" ENABLE ROW LEVEL SECURITY; ALTER TABLE "JournalLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY vila_tenant_guard ON "JournalLine" USING ("orgId"=nullif(current_setting('vila.tenant_id',true),'')) WITH CHECK ("orgId"=nullif(current_setting('vila.tenant_id',true),''));
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_org_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE RESTRICT;
ALTER TABLE "FinancialInvoice" ENABLE ROW LEVEL SECURITY; ALTER TABLE "FinancialInvoice" FORCE ROW LEVEL SECURITY;
CREATE POLICY vila_tenant_guard ON "FinancialInvoice" USING ("orgId"=nullif(current_setting('vila.tenant_id',true),'')) WITH CHECK ("orgId"=nullif(current_setting('vila.tenant_id',true),''));
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_org_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE RESTRICT;
ALTER TABLE "InvoiceLine" ENABLE ROW LEVEL SECURITY; ALTER TABLE "InvoiceLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY vila_tenant_guard ON "InvoiceLine" USING ("orgId"=nullif(current_setting('vila.tenant_id',true),'')) WITH CHECK ("orgId"=nullif(current_setting('vila.tenant_id',true),''));
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_org_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE RESTRICT;
ALTER TABLE "FinancePayment" ENABLE ROW LEVEL SECURITY; ALTER TABLE "FinancePayment" FORCE ROW LEVEL SECURITY;
CREATE POLICY vila_tenant_guard ON "FinancePayment" USING ("orgId"=nullif(current_setting('vila.tenant_id',true),'')) WITH CHECK ("orgId"=nullif(current_setting('vila.tenant_id',true),''));
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_org_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE RESTRICT;
ALTER TABLE "PaymentAllocation" ENABLE ROW LEVEL SECURITY; ALTER TABLE "PaymentAllocation" FORCE ROW LEVEL SECURITY;
CREATE POLICY vila_tenant_guard ON "PaymentAllocation" USING ("orgId"=nullif(current_setting('vila.tenant_id',true),'')) WITH CHECK ("orgId"=nullif(current_setting('vila.tenant_id',true),''));
ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_org_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE RESTRICT;
ALTER TABLE "ReconciliationRecord" ENABLE ROW LEVEL SECURITY; ALTER TABLE "ReconciliationRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY vila_tenant_guard ON "ReconciliationRecord" USING ("orgId"=nullif(current_setting('vila.tenant_id',true),'')) WITH CHECK ("orgId"=nullif(current_setting('vila.tenant_id',true),''));
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_parentId_tenant_fkey" FOREIGN KEY ("orgId","parentId") REFERENCES "LedgerAccount"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_partyId_tenant_fkey" FOREIGN KEY ("orgId","partyId") REFERENCES "Record"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_periodId_tenant_fkey" FOREIGN KEY ("orgId","periodId") REFERENCES "AccountingPeriod"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOf_tenant_fkey" FOREIGN KEY ("orgId","reversalOf") REFERENCES "JournalEntry"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_tenant_fkey" FOREIGN KEY ("orgId","entryId") REFERENCES "JournalEntry"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_tenant_fkey" FOREIGN KEY ("orgId","accountId") REFERENCES "LedgerAccount"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_partyId_tenant_fkey" FOREIGN KEY ("orgId","partyId") REFERENCES "Record"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_partyId_tenant_fkey" FOREIGN KEY ("orgId","partyId") REFERENCES "Record"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_orderId_tenant_fkey" FOREIGN KEY ("orgId","orderId") REFERENCES "Document"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_movementId_tenant_fkey" FOREIGN KEY ("orgId","movementId") REFERENCES "Movement"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_originalId_tenant_fkey" FOREIGN KEY ("orgId","originalId") REFERENCES "FinancialInvoice"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_journalId_tenant_fkey" FOREIGN KEY ("orgId","journalId") REFERENCES "JournalEntry"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_tenant_fkey" FOREIGN KEY ("orgId","invoiceId") REFERENCES "FinancialInvoice"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_productId_tenant_fkey" FOREIGN KEY ("orgId","productId") REFERENCES "Record"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_sourceLineId_tenant_fkey" FOREIGN KEY ("orgId","sourceLineId") REFERENCES "DocumentLine"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_originalLineId_tenant_fkey" FOREIGN KEY ("orgId","originalLineId") REFERENCES "InvoiceLine"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_taxRuleId_tenant_fkey" FOREIGN KEY ("orgId","taxRuleId") REFERENCES "TaxRule"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_accountId_tenant_fkey" FOREIGN KEY ("orgId","accountId") REFERENCES "LedgerAccount"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_id_tenant_fkey" FOREIGN KEY ("orgId","id") REFERENCES "Payment"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_partyId_tenant_fkey" FOREIGN KEY ("orgId","partyId") REFERENCES "Record"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_accountId_tenant_fkey" FOREIGN KEY ("orgId","accountId") REFERENCES "LedgerAccount"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_journalId_tenant_fkey" FOREIGN KEY ("orgId","journalId") REFERENCES "JournalEntry"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_reversalOf_tenant_fkey" FOREIGN KEY ("orgId","reversalOf") REFERENCES "FinancePayment"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_tenant_fkey" FOREIGN KEY ("orgId","paymentId") REFERENCES "FinancePayment"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_tenant_fkey" FOREIGN KEY ("orgId","invoiceId") REFERENCES "FinancialInvoice"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_journalId_tenant_fkey" FOREIGN KEY ("orgId","journalId") REFERENCES "JournalEntry"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_reversalOf_tenant_fkey" FOREIGN KEY ("orgId","reversalOf") REFERENCES "PaymentAllocation"("orgId",id) ON DELETE RESTRICT;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_actor_fkey" FOREIGN KEY ("orgId","createdBy") REFERENCES "Membership"("orgId","userId");
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_actor_fkey" FOREIGN KEY ("orgId","createdBy") REFERENCES "Membership"("orgId","userId");
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_actor_fkey" FOREIGN KEY ("orgId","createdBy") REFERENCES "Membership"("orgId","userId");
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_actor_fkey" FOREIGN KEY ("orgId","createdBy") REFERENCES "Membership"("orgId","userId");
ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_actor_fkey" FOREIGN KEY ("orgId","createdBy") REFERENCES "Membership"("orgId","userId");
ALTER TABLE "JournalEntry" ADD CHECK (currency='TRY');
ALTER TABLE "FinancialInvoice" ADD CHECK (currency='TRY');
ALTER TABLE "FinancePayment" ADD CHECK (currency='TRY');

ALTER TABLE "LedgerAccount" ADD CHECK (category IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'));
ALTER TABLE "AccountingPeriod" ADD CHECK ("startsOn"<="endsOn" AND status IN ('OPEN','CLOSED'));
ALTER TABLE "TaxRule" ADD CHECK (rate BETWEEN 0 AND 100 AND "validFrom"<="validTo" AND classification IN ('STANDARD','ZERO','EXEMPT') AND (classification='STANDARD' OR rate=0));
ALTER TABLE "JournalEntry" ADD CHECK (status IN ('DRAFT','POSTED'));
ALTER TABLE "JournalLine" ADD CHECK (debit>=0 AND credit>=0 AND ((debit>0 AND credit=0) OR (credit>0 AND debit=0)));
ALTER TABLE "FinancialInvoice" ADD CHECK (kind IN ('SALE','PURCHASE','SALES_CREDIT','PURCHASE_CREDIT') AND status IN ('DRAFT','APPROVED','POSTED') AND total>0 AND net>=0 AND tax>=0 AND discount>=0 AND total=net+tax AND "dueOn">="issuedOn" AND ((kind IN ('SALES_CREDIT','PURCHASE_CREDIT'))=("originalId" IS NOT NULL)));
ALTER TABLE "InvoiceLine" ADD CHECK (quantity>0 AND "unitPrice">=0 AND "discountRate" BETWEEN 0 AND 100 AND "taxRate" BETWEEN 0 AND 100 AND net>=0 AND discount>=0 AND tax>=0 AND total=net+tax AND net=round(quantity*"unitPrice",2)-discount AND discount=round(round(quantity*"unitPrice",2)*"discountRate"/100,2) AND tax=round(net*"taxRate"/100,2));
ALTER TABLE "FinancePayment" ADD CHECK (amount>0 AND direction IN ('IN','OUT'));
ALTER TABLE "PaymentAllocation" ADD CHECK (("reversalOf" IS NULL AND amount>0) OR ("reversalOf" IS NOT NULL AND amount<0));
CREATE UNIQUE INDEX "InvoiceLine_invoice_source_key" ON "InvoiceLine" ("orgId","invoiceId","sourceLineId");

CREATE FUNCTION vila_finance_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Immutable financial record: use linked reversal' USING ERRCODE='23514'; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['FinancePayment','PaymentAllocation','ReconciliationRecord','TaxRule'] LOOP
  EXECUTE format('CREATE TRIGGER finance_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION vila_finance_immutable()',t);
 END LOOP;
END $$;
CREATE FUNCTION vila_period_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM "Organization" WHERE id=NEW."orgId" FOR UPDATE;
 IF TG_OP='UPDATE' AND (OLD.status='CLOSED' OR NEW."startsOn"<>OLD."startsOn" OR NEW."endsOn"<>OLD."endsOn") THEN RAISE EXCEPTION 'Period boundaries/closed period immutable' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM "AccountingPeriod" WHERE "orgId"=NEW."orgId" AND id<>NEW.id AND "startsOn"<=NEW."endsOn" AND "endsOn">=NEW."startsOn") THEN RAISE EXCEPTION 'Overlapping period' USING ERRCODE='23514'; END IF;
 IF NEW.status='CLOSED' AND EXISTS(SELECT 1 FROM "JournalEntry" WHERE "orgId"=NEW."orgId" AND "periodId"=NEW.id AND status<>'POSTED') THEN RAISE EXCEPTION 'Unposted journals in period' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER period_guard BEFORE INSERT OR UPDATE ON "AccountingPeriod" FOR EACH ROW EXECUTE FUNCTION vila_period_guard();
CREATE FUNCTION vila_journal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "AccountingPeriod";
BEGIN
 IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND OLD.status='POSTED') THEN RAISE EXCEPTION 'Posted journal immutable' USING ERRCODE='23514'; END IF;
 SELECT * INTO p FROM "AccountingPeriod" WHERE "orgId"=NEW."orgId" AND id=NEW."periodId" FOR SHARE;
 IF p.id IS NULL OR p.status<>'OPEN' OR NEW."effectiveOn" NOT BETWEEN p."startsOn" AND p."endsOn" OR NEW."effectiveOn">CURRENT_DATE THEN RAISE EXCEPTION 'Closed/invalid journal period or date' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER journal_guard BEFORE INSERT OR UPDATE OR DELETE ON "JournalEntry" FOR EACH ROW EXECUTE FUNCTION vila_journal_guard();
CREATE FUNCTION vila_journal_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j "JournalEntry"; a "LedgerAccount"; rowdata "JournalLine";
BEGIN
 IF TG_OP='DELETE' THEN rowdata:=OLD; ELSE rowdata:=NEW; END IF;
 SELECT * INTO j FROM "JournalEntry" WHERE "orgId"=rowdata."orgId" AND id=rowdata."entryId" FOR SHARE;
 IF j.status<>'DRAFT' THEN RAISE EXCEPTION 'Journal lines immutable after posting' USING ERRCODE='23514'; END IF;
 IF TG_OP<>'DELETE' THEN
 SELECT * INTO a FROM "LedgerAccount" WHERE "orgId"=NEW."orgId" AND id=NEW."accountId";
 IF a.id IS NULL OR NOT a.active THEN RAISE EXCEPTION 'Inactive/missing ledger account' USING ERRCODE='23514'; END IF;
 IF (a.purpose IN ('AR','AP','CUSTOMER_ADVANCE','SUPPLIER_ADVANCE'))<>(NEW."partyId" IS NOT NULL) THEN RAISE EXCEPTION 'Control account requires party; other accounts cannot carry party' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN rowdata;
END $$;
CREATE TRIGGER journal_line_guard BEFORE INSERT OR UPDATE OR DELETE ON "JournalLine" FOR EACH ROW EXECUTE FUNCTION vila_journal_line_guard();
CREATE FUNCTION vila_journal_final() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j "JournalEntry"; n int; d numeric; c numeric;
BEGIN
 SELECT * INTO j FROM "JournalEntry" WHERE id=NEW.id;
 SELECT count(*),sum(debit),sum(credit) INTO n,d,c FROM "JournalLine" WHERE "orgId"=j."orgId" AND "entryId"=j.id;
 IF j.status<>'POSTED' OR n<2 OR d<>c THEN RAISE EXCEPTION 'Unbalanced/incomplete journal' USING ERRCODE='23514'; END IF;
 IF j."sourceType"='INVOICE' AND NOT EXISTS(SELECT 1 FROM "FinancialInvoice" WHERE "orgId"=j."orgId" AND id=j."sourceId" AND "journalId"=j.id AND status='POSTED') THEN RAISE EXCEPTION 'Missing posted invoice source' USING ERRCODE='23514'; END IF;
 IF j."sourceType"='PAYMENT' AND NOT EXISTS(SELECT 1 FROM "FinancePayment" WHERE "orgId"=j."orgId" AND id=j."sourceId" AND "journalId"=j.id) THEN RAISE EXCEPTION 'Missing payment source' USING ERRCODE='23514'; END IF;
 IF j."sourceType"='ALLOCATION' AND NOT EXISTS(SELECT 1 FROM "PaymentAllocation" WHERE "orgId"=j."orgId" AND id=j."sourceId" AND "journalId"=j.id) THEN RAISE EXCEPTION 'Missing allocation source' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER journal_final AFTER INSERT OR UPDATE ON "JournalEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vila_journal_final();
CREATE FUNCTION vila_invoice_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n numeric; t numeric; g numeric; d numeric;
BEGIN
 IF TG_OP='DELETE' OR OLD.status='POSTED' THEN RAISE EXCEPTION 'Posted invoice immutable' USING ERRCODE='23514'; END IF;
 IF NEW.status<>OLD.status AND NOT ((OLD.status='DRAFT' AND NEW.status='APPROVED') OR (OLD.status='APPROVED' AND NEW.status='POSTED')) THEN RAISE EXCEPTION 'Invalid invoice transition' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(NEW)-'status'-'journalId')<>(to_jsonb(OLD)-'status'-'journalId') THEN RAISE EXCEPTION 'Invoice snapshot immutable; create replacement draft' USING ERRCODE='23514'; END IF;
 SELECT sum(net),sum(tax),sum(total),sum(discount) INTO n,t,g,d FROM "InvoiceLine" WHERE "orgId"=NEW."orgId" AND "invoiceId"=NEW.id;
 IF n IS NULL OR n<>NEW.net OR t<>NEW.tax OR g<>NEW.total OR d<>NEW.discount THEN RAISE EXCEPTION 'Invoice totals mismatch' USING ERRCODE='23514'; END IF;
 IF NEW.status='POSTED' AND NEW."journalId" IS NULL THEN RAISE EXCEPTION 'Missing invoice journal' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invoice_guard BEFORE UPDATE OR DELETE ON "FinancialInvoice" FOR EACH ROW EXECUTE FUNCTION vila_invoice_guard();
CREATE FUNCTION vila_invoice_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE i "FinancialInvoice"; t "TaxRule";
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Invoice line snapshot immutable' USING ERRCODE='23514'; END IF;
 SELECT * INTO i FROM "FinancialInvoice" WHERE "orgId"=NEW."orgId" AND id=NEW."invoiceId" FOR SHARE;
 SELECT * INTO t FROM "TaxRule" WHERE "orgId"=NEW."orgId" AND id=NEW."taxRuleId";
 IF i.status<>'DRAFT' OR i."issuedOn" NOT BETWEEN t."validFrom" AND t."validTo" OR NEW."taxRate"<>t.rate OR NEW."taxClassification"<>t.classification THEN RAISE EXCEPTION 'Invalid invoice tax snapshot/state' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invoice_line_guard BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceLine" FOR EACH ROW EXECUTE FUNCTION vila_invoice_line_guard();
CREATE FUNCTION vila_account_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD.code<>NEW.code OR OLD.category<>NEW.category OR OLD.purpose IS DISTINCT FROM NEW.purpose OR OLD."partyId" IS DISTINCT FROM NEW."partyId") AND EXISTS(SELECT 1 FROM "JournalLine" WHERE "orgId"=OLD."orgId" AND "accountId"=OLD.id) THEN RAISE EXCEPTION 'Used account identity immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER account_guard BEFORE UPDATE ON "LedgerAccount" FOR EACH ROW EXECUTE FUNCTION vila_account_guard();
CREATE FUNCTION vila_allocation_final() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "FinancePayment"; i "FinancialInvoice"; used numeric; paid numeric; credits numeric; old "PaymentAllocation";
BEGIN
 SELECT * INTO p FROM "FinancePayment" WHERE "orgId"=NEW."orgId" AND id=NEW."paymentId";
 SELECT * INTO i FROM "FinancialInvoice" WHERE "orgId"=NEW."orgId" AND id=NEW."invoiceId";
 IF p."partyId"<>i."partyId" OR p.currency<>i.currency OR i.status<>'POSTED' OR (p.direction='IN')<>(i.kind='SALE') OR p."reversalOf" IS NOT NULL OR EXISTS(SELECT 1 FROM "FinancePayment" WHERE "reversalOf"=p.id) OR NEW."effectiveOn"<p."effectiveOn" OR NEW."effectiveOn"<i."issuedOn" THEN RAISE EXCEPTION 'Invalid allocation parties/source/date' USING ERRCODE='23514'; END IF;
 IF NEW."reversalOf" IS NOT NULL THEN SELECT * INTO old FROM "PaymentAllocation" WHERE id=NEW."reversalOf" AND "orgId"=NEW."orgId"; IF old.id IS NULL OR old."reversalOf" IS NOT NULL OR NEW.amount<>-old.amount OR NEW."paymentId"<>old."paymentId" OR NEW."invoiceId"<>old."invoiceId" OR NEW."effectiveOn"<old."effectiveOn" THEN RAISE EXCEPTION 'Invalid allocation reversal' USING ERRCODE='23514'; END IF; END IF;
 SELECT coalesce(sum(amount),0) INTO used FROM "PaymentAllocation" WHERE "orgId"=NEW."orgId" AND "paymentId"=p.id;
 SELECT coalesce(sum(amount),0) INTO paid FROM "PaymentAllocation" WHERE "orgId"=NEW."orgId" AND "invoiceId"=i.id;
 SELECT coalesce(sum(total),0) INTO credits FROM "FinancialInvoice" WHERE "orgId"=NEW."orgId" AND "originalId"=i.id AND status='POSTED';
 IF used<0 OR used>p.amount OR paid<0 OR paid+credits>i.total THEN RAISE EXCEPTION 'Payment/invoice over-allocation' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER allocation_final AFTER INSERT ON "PaymentAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vila_allocation_final();
