CREATE TABLE "MutationReceipt" (
 "orgId" TEXT NOT NULL, "scope" TEXT NOT NULL, "key" TEXT NOT NULL,
 "requestHash" TEXT NOT NULL, "result" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("orgId","scope","key"),
 FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT
);
CREATE INDEX "DocumentLine_productId_idx" ON "DocumentLine"("productId");
ALTER TABLE "DocumentLine" ADD CONSTRAINT "DocumentLine_product_fkey" FOREIGN KEY ("productId") REFERENCES "Record"("id") ON DELETE RESTRICT;
