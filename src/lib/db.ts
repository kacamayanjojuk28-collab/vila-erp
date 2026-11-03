import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";
const tenant = new AsyncLocalStorage<string>();
export function withTenant<T>(orgId: string, work: () => T): T {
  if (!orgId) throw new Error("Tenant context required");
  return tenant.run(orgId, work);
}
export async function setTransactionTenant(tx: Prisma.TransactionClient, orgId: string) {
  if (process.env.VILA_RLS === "1")
    await tx.$executeRaw`SELECT set_config('vila.tenant_id', ${orgId}, true)`;
}
const g = globalThis as unknown as { db: PrismaClient };
const base =
  g.db ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
if (process.env.NODE_ENV !== "production") g.db = base;

// A tenant context is set on the same connection/transaction as its query.
// Transaction callbacks use the original tx client, never a nested pool query.
const models = new Set(Prisma.dmmf.datamodel.models.map(m => m.name[0].toLowerCase() + m.name.slice(1)));
export const db: PrismaClient = new Proxy(base, {
  get(target, property) {
    const value = Reflect.get(target, property);
    if (property === "$transaction") return (fn: any, options: any) => {
      const orgId = tenant.getStore();
      if (process.env.VILA_RLS !== "1" || !orgId) return target.$transaction(fn, options);
      if (typeof fn !== "function") throw new Error("Tenant transactions require a callback");
      return target.$transaction(async tx => {
        await setTransactionTenant(tx, orgId);
        return fn(tx);
      }, options);
    };
    const scoped = (execute: (client: any) => any) => {
      const orgId = tenant.getStore();
      if (process.env.VILA_RLS !== "1" || !orgId) return execute(target);
      return target.$transaction(async tx => {
        await setTransactionTenant(tx, orgId);
        return execute(tx);
      });
    };
    if (typeof property === "string" && models.has(property)) return new Proxy(value, {
      get(delegate, operation) {
        const method = Reflect.get(delegate, operation);
        return typeof method === "function" ? (...args: any[]) => scoped(client => client[property][operation](...args)) : method;
      },
    });
    if (["$queryRaw", "$executeRaw", "$queryRawUnsafe", "$executeRawUnsafe"].includes(String(property)))
      return (...args: any[]) => scoped(client => client[property](...args));
    return typeof value === "function" ? value.bind(target) : value;
  },
});
