import { tenantDb } from "../isolated";
import "dotenv/config";
import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";
import { randomBytes } from "node:crypto";
import { db } from "../../src/lib/db";
const origin = process.env.VILA_TEST_ORIGIN || "http://localhost:3000";
const stamp = Date.now();
const password = randomBytes(20).toString("hex");
let owner: APIRequestContext,
  other: APIRequestContext,
  viewer: APIRequestContext;
let customer: any, supplier: any, product: any, warehouse: any, order: any;
const headers = { Origin: origin };
async function post(ctx: APIRequestContext, path: string, data: any) {
  const r = await ctx.post("/api/" + path, {
    data,
    headers: ["finance", "stock"].includes(path)
      ? { "Idempotency-Key": randomBytes(16).toString("hex") }
      : undefined,
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
const rec = (name: string, data: any) => ({ name, status: "ACTIVE", data });
test.beforeAll(async () => {
  owner = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  other = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  await post(owner, "auth/register", {
    email: `owner${stamp}@example.test`,
    password,
    name: "Test Owner",
    company: "AUTOMATED TEST " + stamp,
  });
  await post(other, "auth/register", {
    email: `other${stamp}@example.test`,
    password,
    name: "Other Owner",
    company: "ISOLATION TEST " + stamp,
  });
  for (const ctx of [owner, other]) {
    const m = await (await ctx.get("/api/me")).json();
    await db.organization.update({
      where: { id: m.org.id },
      data: { demo: true },
    });
  }
  customer = await post(
    owner,
    "customers",
    rec("Test Customer", {
      email: "customer@example.test",
      phone: "",
      company: "Test Company",
      segment: "SMB",
      notes: "",
    }),
  );
  supplier = await post(
    owner,
    "suppliers",
    rec("Test Supplier", {
      email: "supplier@example.test",
      phone: "",
      company: "Supplier",
      notes: "",
    }),
  );
  warehouse = await post(
    owner,
    "warehouses",
    rec("Test Warehouse", { address: "Local" }),
  );
  product = await post(
    owner,
    "products",
    rec("Test Product", {
      sku: "TEST-" + stamp,
      category: "Test",
      unit: "ADET",
      price: "10.10",
      minStock: "2",
    }),
  );
});
test.afterAll(async () => {
  await owner?.dispose();
  await other?.dispose();
  await viewer?.dispose();
  await db.$disconnect();
});
test("Tenant isolation on reads, writes and foreign record references", async () => {
  const list = await (await other.get("/api/customers")).json();
  expect(list.total).toBe(0);
  expect(
    (
      await other.patch("/api/customers/" + customer.id, {
        data: { ...customer, name: "Intruder" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await other.post("/api/deals", {
        data: rec("Cross tenant", {
          customerId: customer.id,
          stage: "PROPOSAL",
          value: "1",
          dueDate: "",
          notes: "",
        }),
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await other.post("/api/switch", { data: { orgId: customer.orgId } })
    ).status(),
  ).toBe(403);
});
test("CRUD validates input and prevents stale updates, search/filter/pagination work", async () => {
  const r = await owner.patch("/api/customers/" + customer.id, {
    data: { ...customer, name: "Updated Customer" },
  });
  expect(r.status()).toBe(200);
  expect(
    (
      await owner.patch("/api/customers/" + customer.id, {
        data: { ...customer, name: "Stale Customer" },
      })
    ).status(),
  ).toBe(409);
  const query = await (
    await owner.get(
      "/api/customers?q=Updated&status=ACTIVE&sort=name&order=asc",
    )
  ).json();
  expect(query.total).toBe(1);
  expect(
    (
      await owner.post("/api/products", {
        data: rec("Invalid", {
          sku: "BAD",
          category: "",
          unit: "ADET",
          price: "-3",
          minStock: "0",
        }),
      })
    ).status(),
  ).toBe(400);
  const archive = await post(
    owner,
    "leads",
    rec("Archive me", {
      email: "",
      phone: "",
      company: "",
      source: "Test",
      notes: "",
    }),
  );
  expect((await owner.delete("/api/leads/" + archive.id)).status()).toBe(200);
  expect((await (await owner.get("/api/leads")).json()).total).toBe(0);
});
test("Purchase receipt → quote conversion → shipment → exact settlement", async () => {
  const line = {
    productId: product.id,
    quantity: "10",
    price: "10.10",
    discount: 0,
    tax: 20,
  };
  const purchase = await post(owner, "purchases", {
    name: "Test Purchase",
    contactId: supplier.id,
    warehouseId: warehouse.id,
    lines: [line],
  });
  expect(purchase.total).toBe("121.2");
  await post(owner, `purchases/${purchase.id}/confirm`, {});
  await post(owner, `purchases/${purchase.id}/fulfill`, {});
  expect(
    (
      await owner.post(`/api/purchases/${purchase.id}/fulfill`, { data: {} })
    ).status(),
  ).toBe(409);
  const quote = await post(owner, "quotes", {
    name: "Test Quote",
    contactId: customer.id,
    warehouseId: warehouse.id,
    lines: [{ ...line, quantity: "3", discount: 10 }],
  });
  expect(quote.total).toBe("32.72");
  order = await post(owner, `quotes/${quote.id}/convert`, {});
  expect(
    (
      await owner.post(`/api/quotes/${quote.id}/convert`, { data: {} })
    ).status(),
  ).toBe(409);
  await post(owner, `sales/${order.id}/confirm`, {});
  await post(owner, `sales/${order.id}/fulfill`, {});
  await post(owner, "finance", {
    name: "Settlement",
    direction: "IN",
    amount: "32.72",
    documentId: order.id,
  });
  expect(
    (
      await owner.post("/api/finance", {
        headers: { "Idempotency-Key": randomBytes(16).toString("hex") },
        data: {
          name: "Overpayment",
          direction: "IN",
          amount: "0.01",
          documentId: order.id,
        },
      })
    ).status(),
  ).toBe(409);
  const stock = await (await owner.get("/api/stock")).json();
  expect(stock.rows[0].quantity).toBe("7");
  const balance = await (await owner.get("/api/sales")).json();
  expect(balance.rows[0].paid).toBe("32.72");
});
test("Concurrent stock exits cannot oversell; transfer rolls back atomically", async () => {
  const exits = await Promise.all(
    [1, 2].map(() =>
      owner.post("/api/stock", {
        headers: { "Idempotency-Key": randomBytes(16).toString("hex") },
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: "5",
          direction: "OUT",
          reason: "Concurrency test",
        },
      }),
    ),
  );
  expect(exits.map((r) => r.status()).sort()).toEqual([200, 409]);
  const stock = await (await owner.get("/api/stock")).json();
  expect(stock.rows[0].quantity).toBe("2");
  expect(
    (
      await owner.post("/api/stock", {
        headers: { "Idempotency-Key": randomBytes(16).toString("hex") },
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          targetWarehouseId: "invalid",
          quantity: "1",
          direction: "TRANSFER",
          reason: "Rollback test",
        },
      })
    ).status(),
  ).toBe(404);
  expect((await (await owner.get("/api/stock")).json()).rows[0].quantity).toBe(
    "2",
  );
});
test("Invitation is single use and viewer role is enforced on server", async () => {
  const email = `viewer${stamp}@example.test`;
  const invite = await post(owner, "invites", { email, role: "VIEWER" });
  const token = new URL(invite.url).searchParams.get("invite");
  viewer = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  await post(viewer, "auth/register", {
    email,
    password,
    name: "Test Viewer",
    invite: token,
  });
  expect((await viewer.get("/api/customers")).status()).toBe(200);
  expect(
    (
      await viewer.post("/api/customers", {
        data: rec("Forbidden", {
          email: "",
          phone: "",
          company: "",
          segment: "SMB",
          notes: "",
        }),
      })
    ).status(),
  ).toBe(403);
  expect((await viewer.get("/api/audit")).status()).toBe(403);
  expect(
    (
      await viewer.post("/api/organization", {
        data: {
          name: "Hijack",
          currency: "TRY",
          locale: "tr-TR",
          notifications: true,
        },
      })
    ).status(),
  ).toBe(403);
});
test("CSRF and unauthenticated requests are rejected, session cookie is HttpOnly", async () => {
  const anonymous = await request.newContext({ baseURL: origin });
  expect((await anonymous.get("/api/customers")).status()).toBe(401);
  expect(
    (
      await owner.post("/api/profile", {
        headers: { Origin: "https://untrusted.example" },
        data: { name: "Injected" },
      })
    ).status(),
  ).toBe(403);
  const cookie = (await owner.storageState()).cookies.find(
    (c) => c.name === "vila_session",
  );
  expect(cookie?.httpOnly).toBeTruthy();
  expect(cookie?.sameSite).toBe("Lax");
  await anonymous.dispose();
});
test("Browser login, real CRUD persistence, modal keyboard, dark/light and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByLabel("E-posta", { exact: true })
    .fill(`owner${stamp}@example.test`);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page.locator(".overview")).toBeVisible();
  await page.goto("/#customers");
  await page.getByRole("button", { name: "Yeni kayıt", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByLabel("Ad / başlık", { exact: true })
    .fill("Browser Customer");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Browser Customer" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yeni kayıt", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Temayı değiştir" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#settings");
  await expect(
    page.getByRole("heading", { name: "Profil", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "docs/verification/mobile-settings.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("Payment reversal restores receivable, cannot reverse twice, original audit stays intact", async () => {
  const ledger = await (await owner.get("/api/finance")).json();
  const payment = ledger.rows.find((p: any) => p.documentId === order.id);
  await post(owner, "finance/" + payment.id + "/reverse", {
    reason: "Correction test",
  });
  expect(
    (
      await owner.post("/api/finance/" + payment.id + "/reverse", {
        data: { reason: "Again" },
      })
    ).status(),
  ).toBe(409);
  const orders = await (await owner.get("/api/sales")).json();
  expect(orders.rows.find((d: any) => d.id === order.id).paid).toBe("0");
  const ledgerAfter = await (await owner.get("/api/finance")).json();
  expect(ledgerAfter.rows.length).toBe(2);
  expect(ledgerAfter.rows.some((p: any) => p.id === payment.id)).toBeTruthy();
});
test("Purchase request converts once into a persistent purchase order", async () => {
  const r = await post(owner, "requests", {
    name: "Request integration",
    contactId: supplier.id,
    warehouseId: warehouse.id,
    lines: [
      {
        productId: product.id,
        quantity: "2",
        price: "10.10",
        discount: 0,
        tax: 20,
      },
    ],
  });
  const purchase = await post(owner, "requests/" + r.id + "/convert", {});
  expect(purchase.kind).toBe("purchases");
  expect(purchase.sourceId).toBe(r.id);
  expect(
    (
      await owner.post("/api/requests/" + r.id + "/convert", { data: {} })
    ).status(),
  ).toBe(409);
});
test("Database constraints reject negative stock and immutable audit modification", async () => {
  await expect(
    tenantDb(customer.orgId).stock.updateMany({
      where: { orgId: customer.orgId, productId: product.id },
      data: { quantity: -1 },
    }),
  ).rejects.toThrow();
  await expect(
    tenantDb(customer.orgId).audit.deleteMany({ where: { orgId: customer.orgId } }),
  ).rejects.toThrow();
  const result = await tenantDb(customer.orgId).stock.findFirst({
    where: { orgId: customer.orgId, productId: product.id },
  });
  expect(result?.quantity.toString()).toBe("2");
});
test("Currency cannot relabel existing financial records and password change revokes other sessions", async () => {
  const m = await (await owner.get("/api/me")).json();
  expect(
    (
      await owner.post("/api/organization", {
        data: {
          name: m.org.name,
          currency: "USD",
          locale: "tr-TR",
          notifications: true,
        },
      })
    ).status(),
  ).toBe(409);
  const another = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  await post(another, "auth/login", {
    email: `owner${stamp}@example.test`,
    password,
  });
  const newPassword = randomBytes(20).toString("hex");
  expect(
    (
      await owner.post("/api/password", {
        data: { currentPassword: "wrong", newPassword },
      })
    ).status(),
  ).toBe(400);
  await post(owner, "password", { currentPassword: password, newPassword });
  expect((await another.get("/api/me")).status()).toBe(401);
  expect((await owner.get("/api/me")).status()).toBe(200);
  await another.dispose();
});
test("Lead conversion preserves notes and customer timeline links actual activity", async () => {
  const lead = await post(
    owner,
    "leads",
    rec("Qualified lead", {
      email: "lead@example.test",
      phone: "123",
      company: "Lead Company",
      source: "Referral",
      notes: "Preserve this note",
    }),
  );
  const converted = await post(owner, "leads/" + lead.id + "/convert", {});
  expect(converted.kind).toBe("customers");
  expect(converted.data.notes).toBe("Preserve this note");
  await post(
    owner,
    "activities",
    rec("Meeting completed", {
      customerId: converted.id,
      type: "MEETING",
      dueDate: "2026-11-01",
      notes: "Actual meeting note",
    }),
  );
  const history = await (
    await owner.get("/api/history/" + converted.id)
  ).json();
  expect(history.activities[0].data.notes).toBe("Actual meeting note");
  expect((await other.get("/api/history/" + converted.id)).status()).toBe(404);
  expect(
    (
      await owner.post("/api/leads/" + lead.id + "/convert", { data: {} })
    ).status(),
  ).toBe(404);
});
test("Service lines fulfill without artificial stock movements", async () => {
  const service = await post(
    owner,
    "products",
    rec("Installation", {
      sku: "SERVICE-" + stamp,
      category: "Service",
      unit: "HIZMET",
      price: "100",
      minStock: "0",
    }),
  );
  const sale = await post(owner, "sales", {
    name: "Service Order",
    contactId: customer.id,
    warehouseId: warehouse.id,
    lines: [
      {
        productId: service.id,
        quantity: "1",
        price: "100",
        discount: 0,
        tax: 20,
      },
    ],
  });
  await post(owner, "sales/" + sale.id + "/confirm", {});
  await post(owner, "sales/" + sale.id + "/fulfill", {});
  expect(await tenantDb(customer.orgId).stock.count({ where: { productId: service.id } })).toBe(0);
  expect(await tenantDb(customer.orgId).movement.count({ where: { productId: service.id } })).toBe(0);
});
test("All module routes render without errors and reference motion respects reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: origin,
    storageState: await owner.storageState(),
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of [
    "overview",
    "customers",
    "leads",
    "activities",
    "deals",
    "products",
    "warehouses",
    "stock",
    "movements",
    "quotes",
    "sales",
    "requests",
    "purchases",
    "suppliers",
    "finance",
    "projects",
    "tasks",
    "calendar",
    "reports",
    "settings",
    "audit",
  ]) {
    await page.goto("/#" + route);
    await expect(page.locator("main")).toHaveAttribute("data-view", route);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator(".skeleton")).toHaveCount(0);
    expect(
      await page
        .locator("main h1 .title-char")
        .first()
        .evaluate((e) => getComputedStyle(e).transform),
    ).toBe("none");
    await page.screenshot({
      path: "docs/verification/" + route + "-tested.png",
      fullPage: true,
    });
  }
  await page.goto("/#customers");
  await page.getByRole("button", { name: "Yeni kayıt", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Yeni kayıt", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/#overview");
  await expect(page.locator(".overview")).toBeVisible();
  await page
    .getByRole("button", { name: "Genişlet Nakit akışı", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Nakit akışı" })).toBeVisible();
  await expect(page.locator(".card-placeholder")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".card.is-focus")).toHaveCount(0);
  await expect(page.locator(".card-placeholder")).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.close();
});
test("Task changes update project progress transactionally and archive protects relationships", async () => {
  const project = await post(
    owner,
    "projects",
    rec("Task-driven project", {
      customerId: customer.id,
      dueDate: "2026-12-01",
      progress: 0,
      notes: "",
    }),
  );
  const m = await (await owner.get("/api/me")).json();
  let task = await post(owner, "tasks", {
    name: "Complete integration task",
    status: "OPEN",
    data: {
      projectId: project.id,
      assigneeId: m.user.id,
      priority: "HIGH",
      dueDate: "2026-11-10",
      notes: "",
    },
  });
  expect((await owner.delete("/api/projects/" + project.id)).status()).toBe(
    409,
  );
  const r = await owner.patch("/api/tasks/" + task.id, {
    data: { ...task, status: "DONE" },
  });
  expect(r.status()).toBe(200);
  const projects = await (await owner.get("/api/projects")).json();
  expect(
    projects.rows.find((p: any) => p.id === project.id).data.progress,
  ).toBe(100);
  expect((await owner.delete("/api/tasks/" + task.id)).status()).toBe(200);
  expect((await owner.delete("/api/projects/" + project.id)).status()).toBe(
    200,
  );
});

test("Partial receipts and shipments preserve remaining quantity, reject stale duplicates and roll back shortage", async ({
  browser,
}) => {
  const item = await post(
    owner,
    "products",
    rec("Partial product", {
      sku: "PARTIAL-" + stamp,
      category: "Test",
      unit: "ADET",
      price: "10",
      minStock: "0",
    }),
  );
  const create = async (kind: string, name: string, quantity: string) => {
    const d = await post(owner, kind, {
      name,
      contactId: kind === "purchases" ? supplier.id : customer.id,
      warehouseId: warehouse.id,
      lines: [
        { productId: item.id, quantity, price: "10", discount: 0, tax: 0 },
      ],
    });
    await post(owner, `${kind}/${d.id}/confirm`, {});
    return { ...d, version: d.version + 1 };
  };
  const load = async (kind: string, id: string) => {
    const r = await (await owner.get("/api/" + kind)).json();
    return r.rows.find((x: any) => x.id === id);
  };
  const purchase = await create("purchases", "Partial receipt", "10.5");
  const payload = {
    version: purchase.version,
    lines: [{ lineId: purchase.lines[0].id, quantity: "4.25" }],
  };
  const results = await Promise.all([
    owner.post(`/api/purchases/${purchase.id}/fulfill`, { data: payload }),
    owner.post(`/api/purchases/${purchase.id}/fulfill`, { data: payload }),
  ]);
  expect(results.map((r) => r.status()).sort()).toEqual([200, 409]);
  let received = await load("purchases", purchase.id);
  expect(received.status).toBe("PARTIAL");
  expect(received.lines[0].fulfilledQuantity).toBe("4.25");
  expect(
    (
      await owner.post(`/api/purchases/${purchase.id}/fulfill`, {
        data: {
          version: received.version,
          lines: [{ lineId: received.lines[0].id, quantity: "7" }],
        },
      })
    ).status(),
  ).toBe(409);
  const sale = await create("sales", "Partial shipment", "8");
  expect(
    (
      await owner.post(`/api/sales/${sale.id}/fulfill`, {
        data: {
          version: sale.version,
          lines: [{ lineId: sale.lines[0].id, quantity: "5" }],
        },
      })
    ).status(),
  ).toBe(409);
  expect((await load("sales", sale.id)).lines[0].fulfilledQuantity).toBe("0");
  await post(owner, `sales/${sale.id}/fulfill`, {
    version: sale.version,
    lines: [{ lineId: sale.lines[0].id, quantity: "2.25" }],
  });
  const shipped = await load("sales", sale.id);
  expect(shipped.status).toBe("PARTIAL");
  expect(
    (
      await other.post(`/api/sales/${sale.id}/fulfill`, {
        data: {
          version: shipped.version,
          lines: [{ lineId: shipped.lines[0].id, quantity: "1" }],
        },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await owner.post(`/api/sales/${sale.id}/fulfill`, {
        data: {
          version: shipped.version,
          lines: [{ lineId: purchase.lines[0].id, quantity: "1" }],
        },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await owner.post(`/api/sales/${sale.id}/fulfill`, {
        data: {
          version: shipped.version,
          lines: [
            { lineId: shipped.lines[0].id, quantity: "1" },
            { lineId: shipped.lines[0].id, quantity: "1" },
          ],
        },
      })
    ).status(),
  ).toBe(400);
  await post(owner, `purchases/${purchase.id}/fulfill`, {
    version: received.version,
    lines: [{ lineId: received.lines[0].id, quantity: "6.25" }],
  });
  expect((await load("purchases", purchase.id)).status).toBe("FULFILLED");
  const context = await browser.newContext({
    storageState: await owner.storageState(),
  });
  try {
    const page = await context.newPage();
    await page.goto("/#sales");
    await page.getByPlaceholder("Ara…").count();
    const row = page.getByRole("row").filter({ hasText: "Partial shipment" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Sevk et" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByLabel("İşlenecek miktar Partial product"),
    ).toHaveValue("5.75");
    await page.getByRole("button", { name: "Sevkiyatı kaydet" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    await context.close();
  }
  const done = await load("sales", sale.id);
  expect(done.status).toBe("FULFILLED");
  expect(done.lines[0].fulfilledQuantity).toBe("8");
  const stock = (await (await owner.get("/api/stock")).json()).rows.find(
    (r: any) => r.productId === item.id,
  );
  expect(stock.quantity).toBe("2.5");
  const logs = await tenantDb(customer.orgId).audit.findMany({
    where: { entityId: sale.id, action: "FULFILL sales" },
  });
  expect(logs.length).toBe(2);
  const history = await (
    await owner.get(`/api/sales/${sale.id}/deliveries`)
  ).json();
  expect(history).toHaveLength(2);
  expect(history.map((h: any) => h.detail.lines[0].quantity).sort()).toEqual([
    "2.25",
    "5.75",
  ]);
  expect((await other.get(`/api/sales/${sale.id}/deliveries`)).status()).toBe(
    404,
  );
});
