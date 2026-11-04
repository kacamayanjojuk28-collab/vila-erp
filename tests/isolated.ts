import { db, withTenant } from "../src/lib/db";
export function assertIsolated() {
  const url = new URL(process.env.DATABASE_URL!);
  const allowed = (url.port === "6543" && url.pathname === "/vila_hardening" && process.env.VILA_TEST_ORIGIN === "http://localhost:3100") ||
    (url.port === "7543" && url.pathname === "/vila_sprint_01" && process.env.VILA_TEST_ORIGIN === "http://localhost:3200");
  const rc = url.port === "8543" && url.pathname === "/vila_rc_090" && process.env.VILA_TEST_ORIGIN === "http://localhost:3300";
  const finance = url.port === "9543" && url.pathname === "/vila_finance_v1" && process.env.VILA_TEST_ORIGIN === "http://localhost:3400";
  if (url.hostname !== "127.0.0.1" || !(allowed || rc || finance || (url.port === "9543" && url.pathname === "/vila_dashboard_v1" && process.env.VILA_TEST_ORIGIN === "http://localhost:3500"))) throw new Error("Named isolated database/origin required");
}
// Explicit tenant selection for direct DB fixture/assertion operations, not a bypass role.
export function tenantDb(orgId: string): typeof db {
  return new Proxy(db, {get(target, model) {
    const delegate = Reflect.get(target, model);
    return new Proxy(delegate, {get(object, method) {
      return (...args: any[]) => withTenant(orgId, () => Reflect.get(object, method).apply(object, args));
    }});
  }});
}
