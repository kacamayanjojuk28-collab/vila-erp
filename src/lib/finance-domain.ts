import { z } from "zod";
import { decimal, money, qty } from "./domain";
export const positiveMoney = money.refine(v => decimal(v).gt(0));
export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v);
export const dateValue = (v: string) => new Date(v + "T00:00:00Z");
export const today = (at:Date = new Date()) => new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Istanbul"}).format(at);
export const invoiceLineInput = z.object({
  name:z.string().trim().min(1).max(160), productId:z.string().optional(), sourceLineId:z.string().optional(),
  quantity:qty, unitPrice:money, discountRate:z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).refine(v=>decimal(v).lte(100)).default("0"),
  taxRuleId:z.string().min(1), accountId:z.string().optional(),
});
export function invoiceAmounts(quantity:string, unitPrice:string, discountRate:string, taxRate:string) {
  const gross=decimal(quantity).mul(unitPrice).toDecimalPlaces(2);
  const discount=gross.mul(discountRate).div(100).toDecimalPlaces(2);
  const net=gross.sub(discount), tax=net.mul(taxRate).div(100).toDecimalPlaces(2);
  return {net,discount,tax,total:net.add(tax)};
}
export const invoiceInput=z.object({kind:z.enum(["SALE","PURCHASE"]),partyId:z.string().min(1),issuedOn:day,dueOn:day,currency:z.literal("TRY").default("TRY"),orderId:z.string().optional(),movementId:z.string().optional(),lines:z.array(invoiceLineInput).min(1).max(100)});
export const effectiveInput=z.object({effectiveOn:day,backdateReason:z.string().trim().max(500).optional(),reason:z.string().trim().min(3).max(500).optional()});
