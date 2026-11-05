import { assertIsolated, tenantDb } from "../isolated";
import "dotenv/config";
import { request } from "../company-request";
import { test, expect } from "@playwright/test";
import { db } from "../../src/lib/db";
import { randomBytes } from "node:crypto";
const origin = process.env.VILA_TEST_ORIGIN;
test.beforeAll(assertIsolated);
test.afterAll(() => db.$disconnect());
test("HARDENING one exhausted global bucket cannot block an unrelated login", async () => {
  const api = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin! },
  });
  try {
    await db.rateLimit.upsert({
      where: { key: "auth-global" },
      create: {
        key: "auth-global",
        count: 151,
        until: new Date(Date.now() + 600000),
      },
      update: { count: 151, until: new Date(Date.now() + 600000) },
    });
    const r = await api.post("/api/auth/login", {
      data: {
        email: `unknown-${Date.now()}@example.test`,
        password: randomBytes(20).toString("hex"),
      },
    });
    expect(r.status()).toBe(401);
  } finally {
    await db.rateLimit.deleteMany({ where: { key: "auth-global" } });
    await api.dispose();
  }
});
test("HARDENING stock and finance require a replay key before writing", async () => {
  const api = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin! },
  });
  try {
    expect(
      (
        await api.post("/api/auth/register", {
          data: {
            email: `mandatory-${Date.now()}@example.test`,
            password: randomBytes(20).toString("hex"),
            name: "Isolated QA",
            company: "Hardening QA",
          },
        })
      ).ok(),
    ).toBeTruthy();
    const me = await (await api.get("/api/me")).json();
    await db.organization.update({
      where: { id: me.org.id },
      data: { demo: true },
    });
    expect(
      (
        await api.post("/api/finance", {
          data: { name: "No key", direction: "IN", amount: "1" },
        })
      ).status(),
    ).toBe(400);
    expect(await tenantDb(me.org.id).payment.count({ where: { orgId: me.org.id } })).toBe(0);
  } finally {
    await api.dispose();
  }
});

test("HARDENING rate counter is atomic across simultaneous expired-window requests", async () => {
  const { rateLimit } = await import("../../src/lib/security");
  const key = "hardening-rate-" + Date.now();
  await db.rateLimit.create({
    data: { key, count: 99, until: new Date(Date.now() - 1000) },
  });
  const result = await Promise.allSettled(
    Array.from({ length: 30 }, () => rateLimit(key, 10)),
  );
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(10);
  for (const r of result.filter((r) => r.status === "rejected"))
    expect((r as PromiseRejectedResult).reason.status).toBe(429);
  expect((await db.rateLimit.findUnique({ where: { key } }))?.count).toBe(30);
});
test("HARDENING document line rejects another tenant product in raw DB write", async () => {
  const api = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin! },
  });
  try {
    await api.post("/api/auth/register", {
      data: {
        email: `tenant-fk-${Date.now()}@example.test`,
        password: randomBytes(20).toString("hex"),
        name: "FK QA",
        company: "FK QA",
      },
    });
    const me = await (await api.get("/api/me")).json();
    await db.organization.update({
      where: { id: me.org.id },
      data: { demo: true },
    });
    const foreign = await db.organization.create({
      data: { name: "Foreign FK QA", demo: true },
    });
    const foreignProduct = await tenantDb(foreign.id).record.create({
      data: {
        orgId: foreign.id,
        kind: "products",
        name: "Foreign product",
        data: { unit: "ADET" },
      },
    });
    const customer = await tenantDb(me.org.id).record.create({
        data: { orgId: me.org.id, kind: "customers", name: "Customer" },
      }),
      warehouse = await tenantDb(me.org.id).record.create({
        data: { orgId: me.org.id, kind: "warehouses", name: "Warehouse" },
      });
    const doc = await tenantDb(me.org.id).document.create({
      data: {
        orgId: me.org.id,
        kind: "sales",
        name: "FK doc",
        contactId: customer.id,
        warehouseId: warehouse.id,
        total: "0",
      },
    });
    await expect(
      tenantDb(me.org.id).documentLine.create({
        data: {
          documentId: doc.id,
          productId: foreignProduct.id,
          name: "Foreign",
          quantity: "1",
          price: "1",
          discount: "0",
          tax: "0",
          total: "1",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    expect(await tenantDb(me.org.id).documentLine.count({ where: { documentId: doc.id } })).toBe(
      0,
    );
    await expect(
      tenantDb(me.org.id).mutationReceipt.deleteMany({ where: { orgId: me.org.id } }),
    ).rejects.toThrow();
  } finally {
    await api.dispose();
  }
});
