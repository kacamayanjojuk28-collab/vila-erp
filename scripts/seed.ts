import "dotenv/config";
import { db, withTenant } from "../src/lib/db";
import { passwordHash } from "../src/lib/security";
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
async function seed() {
  const visual = process.env.VILA_VISUAL_SEED === "1";
  const createdAt = visual ? new Date("2026-11-01T09:00:00Z") : undefined;
  const credentialsPath = process.env.VILA_VISUAL_CREDENTIALS || (visual ? ".local/visual-credentials.json" : ".local/demo-credentials.json");
  if (process.env.NODE_ENV === "production")
    throw Error("Demo seed production ortamında kapalı.");
  const email = "demo." + Date.now() + "@vila.local",
    password = randomBytes(20).toString("base64url");
  const user = await db.user.create({
    data: { email, name: "Deniz Yılmaz", password: await passwordHash(password) },
  });
  const org = await db.organization.create({
    data: { name: "VILA Demo", demo: true },
  });
  await db.membership.create({
    data: { orgId: org.id, userId: user.id, role: "OWNER" },
  });
  await withTenant(org.id, async () => {
  const create = (kind: string, name: string, data: any, status = "ACTIVE") =>
    db.record.create({
      data: {
        orgId: org.id,
        createdAt,
        kind,
        name,
        data,
        status,
        amount: data.price ?? data.value ?? 0,
        code: data.sku ?? null,
      },
    });
  const warehouse = await create("warehouses", "İstanbul ana depo", {
    address: "İstanbul",
  });
  await create("warehouses", "Ankara bölge depo", { address: "Ankara" });
  const customers = [];
  for (const [i, name] of [
    "Atlas Teknoloji",
    "Kuzey Lojistik",
    "Mavi Enerji",
    "Duru Mimarlık",
    "Eksen Üretim",
    "Nova Otelcilik",
    "Arda Yapı",
    "Luna Tasarım",
  ].entries())
    customers.push(
      await create("customers", name, {
        company: name,
        email: "iletisim" + i + "@example.com",
        phone: "",
        segment: i % 3 === 0 ? "ENTERPRISE" : i % 3 === 1 ? "MID" : "SMB",
        notes: "Açıkça işaretlenmiş demo kayıt.",
      }),
    );
  await create("suppliers", "Örnek Tedarik A.Ş.", {
    company: "Örnek Tedarik",
    email: "supply@example.com",
    phone: "",
    notes: "",
  });
  for (const [i, name] of [
    "Kontrol ünitesi",
    "Sensör modülü",
    "Bağlantı kablosu",
    "Kurulum hizmeti",
  ].entries()) {
    const product = await create("products", name, {
      sku: "VILA-" + (100 + i),
      category: i === 3 ? "Hizmet" : "Elektronik",
      unit: i === 3 ? "HIZMET" : "ADET",
      price: String((i + 1) * 1250),
      minStock: "10",
    });
    if (i !== 3) {
      await db.stock.create({
        data: {
          orgId: org.id,
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: i === 2 ? 4 : 50,
        },
      });
      await db.movement.create({
        data: {
          orgId: org.id,
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: i === 2 ? 4 : 50,
          reason: "DEMO açılış stoku",
          actorId: user.id,
        },
      });
    }
  }
  for (const [i, name] of [
    "Otomasyon yenileme",
    "Depo modernizasyonu",
    "Enerji izleme sistemi",
    "Yıllık bakım sözleşmesi",
    "Yeni şube kurulumu",
    "Kontrol paneli",
  ].entries())
    await create("deals", name, {
      customerId: customers[i].id,
      stage: ["QUALIFICATION", "PROPOSAL", "NEGOTIATION"][i % 3],
      value: String(25000 + i * 7500),
      dueDate: "2026-11-" + (12 + i),
      notes: "",
    });
  for (const [i, name] of [
    "Dijital dönüşüm",
    "Depo kurulumu",
    "Saha operasyonu",
  ].entries()) {
    const project = await create("projects", name, {
      customerId: customers[i].id,
      dueDate: "2026-12-15",
      progress: 25 + i * 25,
      notes: "",
    });
    await create(
      "tasks",
      "Planı gözden geçir · " + name,
      {
        projectId: project.id,
        assigneeId: user.id,
        priority: "MEDIUM",
        dueDate: "2026-11-10",
        notes: "",
      },
      i === 0 ? "DONE" : "OPEN",
    );
  }
  for (let i = 0; i < 6; i++) {
    const date = new Date(createdAt ?? Date.now());
    date.setDate(10);
    date.setMonth(date.getMonth() - i);
    await db.payment.create({
      data: {
        orgId: org.id,
        name: "DEMO aylık tahsilat",
        direction: "IN",
        amount: String(18000 + (i % 3) * 12000),
        createdAt: date,
      },
    });
  }
  await db.audit.create({
    data: {
      orgId: org.id,
      userId: user.id,
      createdAt,
      action: "DEMO DATA CREATED",
      entityId: org.id,
    },
  });
  });
  mkdirSync(".local", { recursive: true });
  writeFileSync(
    credentialsPath,
    JSON.stringify({ email, password, orgId: org.id, userId: user.id }),
  );
  console.log(
    "Demo şirketi oluşturuldu. Kimlik bilgileri yalnızca " + credentialsPath + " içinde.",
  );
}
seed().finally(() => db.$disconnect());
