import { assertIsolated, tenantDb } from "../isolated";
import { request } from "../company-request";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";

test("Dashboard summary preserves totals, reports and monthly charts across date filters", async () => {
  assertIsolated();
  const credentials = JSON.parse(readFileSync(process.env.VILA_VISUAL_CREDENTIALS!, "utf8"));
  const tenants = JSON.parse(readFileSync(".local/load-tenants.json", "utf8"));
  const api = await request.newContext({ baseURL: process.env.VILA_TEST_ORIGIN, extraHTTPHeaders: { Origin: process.env.VILA_TEST_ORIGIN! } });
  try {
    expect((await api.post("/api/auth/login", { data: credentials })).ok()).toBeTruthy();
    for (const orgId of tenants) {
      expect((await api.post("/api/switch", { data: { orgId } })).ok()).toBeTruthy();
      for (const range of ["", "&from=2026-11-03&to=2026-11-03", "&from=2000-01-01&to=2000-01-02"]) {
        const fullResponse = await api.get("/api/dashboard?" + range);
        const summaryResponse = await api.get("/api/dashboard?view=summary" + range);
        expect(fullResponse.ok()).toBeTruthy();
        expect(summaryResponse.ok()).toBeTruthy();
        const full = await fullResponse.json(), summary = await summaryResponse.json();
        for (const key of ["income", "expense", "net", "receivable", "payable", "overdue", "aging", "reports", "stocks", "activities"])
          expect(summary[key], key).toEqual(full[key]);
        expect(summary).not.toHaveProperty("documents");
        expect(summary).not.toHaveProperty("payments");
        expect(summary.records).toEqual(full.records.filter((r: any) => ["deals", "tasks", "projects", "products", "activities"].includes(r.kind)));
        const months = new Map<string, Prisma.Decimal>();
        for (const p of full.payments) {
          const key = p.createdAt.slice(0, 7) + p.direction;
          months.set(key, (months.get(key) ?? new Prisma.Decimal(0)).add(p.amount));
        }
        expect(summary.monthlyPayments).toHaveLength(months.size);
        for (const p of summary.monthlyPayments)
          expect(p.amount).toBe(months.get(p.createdAt.slice(0, 7) + p.direction)!.toString());
        expect((await summaryResponse.body()).length).toBeLessThan(1024 * 1024);
      }
    }
  } finally { await api.dispose(); }
});
