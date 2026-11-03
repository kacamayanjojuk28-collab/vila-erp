import "dotenv/config";
import { db } from "../src/lib/db";
import { readFileSync } from "node:fs";
async function main() {
  const c = JSON.parse(readFileSync(".local/demo-credentials.json", "utf8"));
  const products = await db.record.findMany({
    where: { orgId: c.orgId, kind: "products" },
  });
  for (const p of products) {
    if ((p.data as any).unit !== "HIZMET") continue;
    const stocks = await db.stock.findMany({
      where: { orgId: c.orgId, productId: p.id, quantity: { gt: 0 } },
    });
    for (const stock of stocks)
      await db.$transaction(async (tx) => {
        await tx.stock.update({
          where: {
            orgId_productId_warehouseId: {
              orgId: stock.orgId,
              productId: stock.productId,
              warehouseId: stock.warehouseId,
            },
          },
          data: { quantity: 0 },
        });
        await tx.movement.create({
          data: {
            orgId: stock.orgId,
            productId: stock.productId,
            warehouseId: stock.warehouseId,
            quantity: stock.quantity.negated(),
            reason: "DEMO hizmet stok düzeltmesi",
            actorId: c.userId,
          },
        });
      });
  }
  await db.$disconnect();
  console.log("Demo service stock corrected through an offset movement.");
}
main().finally(() => db.$disconnect());
