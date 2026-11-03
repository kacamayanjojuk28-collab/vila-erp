ALTER TABLE "DocumentLine" ADD COLUMN "fulfilledQuantity" DECIMAL(18,3) NOT NULL DEFAULT 0;
UPDATE "DocumentLine" l SET "fulfilledQuantity"=l.quantity FROM "Document" d WHERE l."documentId"=d.id AND d.status='FULFILLED';
ALTER TABLE "DocumentLine" ADD CONSTRAINT "DocumentLine_fulfillment_bounds" CHECK ("fulfilledQuantity">=0 AND "fulfilledQuantity"<=quantity);
