import { Prisma } from "@prisma/client";
import { z } from "zod";
export const decimal = (v: string | number | Prisma.Decimal) =>
  new Prisma.Decimal(v);
export const money = z
  .string()
  .regex(
    /^\d{1,12}(\.\d{1,2})?$/,
    "Pozitif tutar, en fazla iki ondalık basamak.",
  );
export const qty = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,3})?$/)
  .refine((v) => decimal(v).gt(0), "Miktar sıfırdan büyük olmalı.");
const text = z.string().trim().max(500);
const id = z.string().min(1).max(100);
const date = z
  .string()
  .refine((v) => !v || !isNaN(Date.parse(v)), "Geçersiz tarih");
export const recordSchemas: Record<string, z.ZodType> = {
  customers: z.object({
    email: z.email().or(z.literal("")),
    phone: text,
    company: text,
    segment: z.enum(["SMB", "MID", "ENTERPRISE"]),
    notes: text,
  }),
  suppliers: z.object({
    email: z.email().or(z.literal("")),
    phone: text,
    company: text,
    notes: text,
  }),
  leads: z.object({
    email: z.email().or(z.literal("")),
    phone: text,
    company: text,
    source: text,
    notes: text,
  }),
  products: z.object({
    sku: text.min(1),
    category: text,
    unit: z.enum(["ADET", "KG", "SAAT", "HIZMET"]),
    price: money,
    minStock: money,
  }),
  warehouses: z.object({ address: text }),
  deals: z.object({
    customerId: id,
    stage: z.enum(["QUALIFICATION", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]),
    value: money,
    dueDate: date,
    notes: text,
  }),
  projects: z.object({
    customerId: text,
    dueDate: date,
    progress: z.coerce.number().int().min(0).max(100),
    notes: text,
  }),
  tasks: z.object({
    projectId: text,
    assigneeId: text,
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
    dueDate: date,
    notes: text,
  }),
  activities: z.object({
    customerId: id,
    type: z.enum(["NOTE", "CALL", "MEETING", "EMAIL"]),
    dueDate: date,
    notes: text,
  }),
};
export const recordInput = z.object({
  name: z.string().trim().min(1).max(160),
  status: z
    .enum(["ACTIVE", "OPEN", "IN_PROGRESS", "DONE", "CANCELLED"])
    .default("ACTIVE"),
  data: z.record(z.string(), z.unknown()),
  version: z.number().int().positive().optional(),
});
export const lineInput = z.object({
  productId: id,
  quantity: qty,
  price: money,
  discount: z.coerce.number().min(0).max(100),
  tax: z.coerce.number().min(0).max(100),
});
export function lineTotal(line: z.infer<typeof lineInput>) {
  return decimal(line.quantity)
    .mul(line.price)
    .mul(decimal(100).minus(line.discount))
    .div(100)
    .mul(decimal(100).plus(line.tax))
    .div(100)
    .toDecimalPlaces(2);
}
export const documentInput = z.object({
  dueDate: date.optional(),
  name: z.string().trim().min(1).max(160),
  contactId: id,
  warehouseId: id,
  lines: z.array(lineInput).min(1).max(100),
  version: z.number().int().positive().optional(),
});
export const documentKinds = ["quotes", "sales", "purchases", "requests"];
