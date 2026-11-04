import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import {
  decimal,
  qty,
  documentInput,
  documentKinds,
  lineTotal,
  recordInput,
  recordSchemas,
} from "./domain";
import { AppError, authorize, type Actor } from "./security";
type Tx = Prisma.TransactionClient;
export async function audit(
  tx: Tx,
  a: Actor,
  action: string,
  entityId: string,
  detail: Prisma.InputJsonValue = {},
) {
  await tx.audit.create({
    data: { orgId: a.orgId, userId: a.userId, action, entityId, detail },
  });
}
export async function ref(tx: Tx, a: Actor, id: string, kind: string) {
  const r = await tx.record.findFirst({
    where: { id, orgId: a.orgId, kind, archived: false },
  });
  if (!r) throw new AppError("Bağlantılı kayıt bulunamadı: " + kind, 404);
  return r;
}
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: "Serializable",
        timeout: 15000,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2034" &&
        i < 2
      )
        continue;
      throw e;
    }
  }
  throw new Error("Unreachable");
}
async function recalculateProject(tx: Tx, a: Actor, id: string) {
  if (!id) return;
  const project = await tx.record.findFirst({
    where: { id, orgId: a.orgId, kind: "projects", archived: false },
  });
  if (!project) return;
  const tasks = await tx.record.findMany({
    where: {
      orgId: a.orgId,
      kind: "tasks",
      archived: false,
      data: { path: ["projectId"], equals: id },
    },
    select: { status: true },
  });
  const data = project.data as Prisma.InputJsonObject;
  await tx.record.update({
    where: { id },
    data: {
      data: {
        ...data,
        progress: tasks.length
          ? Math.round(
              (tasks.filter((t) => t.status === "DONE").length / tasks.length) *
                100,
            )
          : 0,
        taskCount: tasks.length,
      },
      version: { increment: 1 },
    },
  });
}
export async function saveRecord(
  a: Actor,
  kind: string,
  input: unknown,
  id?: string,
) {
  authorize(a, kind);
  if (!recordSchemas[kind]) throw new AppError("Geçersiz modül");
  const v = recordInput.parse(input);
  const data = recordSchemas[kind].parse(v.data) as Record<string, any>;
  if (
    kind === "tasks" &&
    !["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"].includes(v.status)
  )
    throw new AppError("Geçersiz görev durumu");
  return transaction(async (tx) => {
    let previousProjectId = "";
    if (kind === "projects" && id) {
      const tasks = await tx.record.findMany({
        where: {
          orgId: a.orgId,
          kind: "tasks",
          archived: false,
          data: { path: ["projectId"], equals: id },
        },
        select: { status: true },
      });
      if (tasks.length) {
        data.progress = Math.round(
          (tasks.filter((t) => t.status === "DONE").length / tasks.length) *
            100,
        );
        data.taskCount = tasks.length;
      }
    }

    if (data.customerId) await ref(tx, a, data.customerId, "customers");
    if (data.projectId) await ref(tx, a, data.projectId, "projects");
    if (
      data.assigneeId &&
      !(await tx.membership.findFirst({
        where: { orgId: a.orgId, userId: data.assigneeId, active: true },
      }))
    )
      throw new AppError("Geçersiz görev ataması");
    const values = {
      name: v.name,
      status: v.status,
      data: data as Prisma.InputJsonValue,
      amount: decimal(data.value ?? data.price ?? "0"),
      code: kind === "products" ? String(data.sku) : null,
    };
    let result;
    if (id) {
      const existing = await ref(tx, a, id, kind);
      if (kind === "tasks")
        previousProjectId = String(
          (existing.data as Record<string, string>).projectId ?? "",
        );
      if (
        kind === "products" &&
        (existing.data as Record<string, string>).unit !== data.unit &&
        ((await tx.stock.count({
          where: { orgId: a.orgId, productId: id, quantity: { not: 0 } },
        })) ||
          (await tx.documentLine.count({ where: { productId: id } })))
      )
        throw new AppError("İşlem görmüş ürünün birimi değiştirilemez.", 409);
      if (existing.version !== v.version)
        throw new AppError("Kayıt değişmiş. Yenileyip tekrar deneyin.", 409);
      result = await tx.record.update({
        where: { id },
        data: { ...values, version: { increment: 1 } },
      });
    } else
      result = await tx.record.create({
        data: { ...values, orgId: a.orgId, kind },
      });
    if (kind === "tasks") {
      await recalculateProject(tx, a, data.projectId);
      if (previousProjectId && previousProjectId !== data.projectId)
        await recalculateProject(tx, a, previousProjectId);
    }
    await audit(tx, a, id ? "UPDATE " + kind : "CREATE " + kind, result.id, {
      name: result.name,
    });
    return result;
  });
}
export async function saveDocument(
  a: Actor,
  kind: string,
  input: unknown,
  id?: string,
) {
  authorize(a, kind);
  const v = documentInput.parse(input);
  return transaction(async (tx) => {
    await ref(
      tx,
      a,
      v.contactId,
      ["purchases", "requests"].includes(kind) ? "suppliers" : "customers",
    );
    await ref(tx, a, v.warehouseId, "warehouses");
    const lines = [];
    for (const line of v.lines) {
      const product = await ref(tx, a, line.productId, "products");
      lines.push({
        ...line,
        discount: decimal(line.discount),
        tax: decimal(line.tax),
        name: product.name,
        total: lineTotal(line),
      });
    }
    const total = lines.reduce((t, l) => t.add(l.total), decimal(0));
    const data = {
      dueDate: v.dueDate ? new Date(v.dueDate) : null,
      name: v.name,
      contactId: v.contactId,
      warehouseId: v.warehouseId,
      total,
    };
    let result;
    if (id) {
      const d = await tx.document.findFirst({
        where: { id, orgId: a.orgId, kind, archived: false },
      });
      if (!d) throw new AppError("Belge bulunamadı", 404);
      if (d.status !== "DRAFT" || d.version !== v.version)
        throw new AppError("Yalnızca güncel taslak düzenlenebilir", 409);
      await tx.documentLine.deleteMany({ where: { documentId: id } });
      result = await tx.document.update({
        where: { id },
        data: { ...data, version: { increment: 1 }, lines: { create: lines } },
        include: { lines: true },
      });
    } else
      result = await tx.document.create({
        data: { ...data, orgId: a.orgId, kind, lines: { create: lines } },
        include: { lines: true },
      });
    await audit(tx, a, id ? "UPDATE " + kind : "CREATE " + kind, result.id);
    return result;
  });
}
export async function adjustStock(
  tx: Tx,
  a: Actor,
  productId: string,
  warehouseId: string,
  quantity: Prisma.Decimal,
  reason: string,
  reference?: string,
) {
  const product = await ref(tx, a, productId, "products");
  if (
    ["HIZMET", "SAAT"].includes((product.data as Record<string, string>).unit)
  )
    throw new AppError("Hizmet kalemlerinde stok hareketi yapılamaz.");
  await ref(tx, a, warehouseId, "warehouses");
  const key = { orgId: a.orgId, productId, warehouseId };
  await tx.stock.upsert({
    where: { orgId_productId_warehouseId: key },
    create: { ...key, quantity: 0 },
    update: {},
  });
  const changed = await tx.stock.updateMany({
    where: {
      ...key,
      ...(quantity.lt(0) ? { quantity: { gte: quantity.abs() } } : {}),
    },
    data: { quantity: { increment: quantity } },
  });
  if (changed.count !== 1)
    throw new AppError("Yetersiz stok. İşlem geri alındı.", 409);
  return tx.movement.create({
    data: { ...key, quantity, reason, reference, actorId: a.userId },
  });
}
export async function workflow(
  a: Actor,
  kind: string,
  id: string,
  action: string,
  body: unknown = {},
) {
  authorize(a, kind);
  return transaction(async (tx) => {
    const d = await tx.document.findFirst({
      where: { id, orgId: a.orgId, kind, archived: false },
      include: { lines: true },
    });
    if (!d) throw new AppError("Belge bulunamadı", 404);
    if (
      action === "convert" &&
      ["quotes", "requests"].includes(kind) &&
      d.status === "DRAFT"
    ) {
      authorize(a, kind === "quotes" ? "sales" : "purchases");
      const result = await tx.document.create({
        data: {
          orgId: a.orgId,
          kind: kind === "quotes" ? "sales" : "purchases",
          name: d.name + " / Sipariş",
          contactId: d.contactId,
          warehouseId: d.warehouseId,
          dueDate: d.dueDate,
          total: d.total,
          sourceId: d.id,
          lines: {
            create: d.lines.map((l) => ({
              productId: l.productId,
              name: l.name,
              quantity: l.quantity,
              price: l.price,
              discount: l.discount,
              tax: l.tax,
              total: l.total,
            })),
          },
        },
      });
      await tx.document.update({
        where: { id },
        data: { status: "CONVERTED", version: { increment: 1 } },
      });
      await audit(tx, a, kind === "requests" ? "CONVERT REQUEST" : "CONVERT QUOTE", id, { orderId: result.id });
      return result;
    }
    if (
      action === "confirm" &&
      ["sales", "purchases"].includes(kind) &&
      d.status === "DRAFT"
    ) {
      await tx.document.update({
        where: { id },
        data: { status: "CONFIRMED", version: { increment: 1 } },
      });
      await audit(tx, a, "CONFIRM " + kind, id);
      return { ok: true };
    }
    if (
      action === "fulfill" &&
      ["sales", "purchases"].includes(kind) &&
      ["CONFIRMED", "PARTIAL"].includes(d.status)
    ) {
      const input = z
        .object({
          version: z.number().int().positive().optional(),
          lines: z
            .array(z.object({ lineId: z.string().min(1), quantity: qty }))
            .min(1)
            .max(500)
            .optional(),
        })
        .parse(body);
      if (input.lines && input.version === undefined)
        throw new AppError("Belge sürümü gerekli.");
      if (input.version !== undefined && input.version !== d.version)
        throw new AppError(
          "Belge değişmiş. Güncel miktarları görmek için listeyi yenileyin.",
          409,
        );
      const selected =
        input.lines ??
        d.lines
          .filter((l) => l.fulfilledQuantity.lt(l.quantity))
          .map((l) => ({
            lineId: l.id,
            quantity: l.quantity.sub(l.fulfilledQuantity).toString(),
          }));
      if (new Set(selected.map((l) => l.lineId)).size !== selected.length)
        throw new AppError("Aynı kalem birden fazla seçilemez.");
      const processed: { lineId: string; name: string; quantity: string }[] =
        [];
      for (const item of selected) {
        const l = d.lines.find((l) => l.id === item.lineId);
        if (!l) throw new AppError("Belge kalemi bulunamadı", 404);
        const amount = decimal(item.quantity);
        if (amount.gt(l.quantity.sub(l.fulfilledQuantity)))
          throw new AppError(
            "İşlenen miktar kalan miktarı aşamaz: " + l.name,
            409,
          );
        const product = await ref(tx, a, l.productId, "products");
        const unit = (product.data as Record<string, unknown>).unit;
        if (unit !== "HIZMET" && unit !== "SAAT")
          await adjustStock(
            tx,
            a,
            l.productId,
            d.warehouseId,
            kind === "purchases" ? amount : amount.negated(),
            kind === "purchases" ? "RECEIPT" : "SHIPMENT",
            id,
          );
        await tx.documentLine.update({
          where: { id: l.id },
          data: { fulfilledQuantity: { increment: amount } },
        });
        l.fulfilledQuantity = l.fulfilledQuantity.add(amount);
        processed.push({
          lineId: l.id,
          name: l.name,
          quantity: amount.toString(),
        });
      }
      const status = d.lines.every((l) => l.fulfilledQuantity.eq(l.quantity))
        ? "FULFILLED"
        : "PARTIAL";
      await tx.document.update({
        where: { id },
        data: { status, version: { increment: 1 } },
      });
      await audit(tx, a, "FULFILL " + kind, id, { lines: processed, status });
      return { ok: true, status };
    }
    throw new AppError("Bu durum geçişi geçerli değil.", 409);
  });
}
export async function archive(a: Actor, kind: string, id: string) {
  authorize(a, kind);
  return transaction(async (tx) => {
    if (documentKinds.includes(kind)) {
      const d = await tx.document.findFirst({
        where: { id, orgId: a.orgId, kind, archived: false },
      });
      if (!d) throw new AppError("Bulunamadı", 404);
      if (d.status !== "DRAFT")
        throw new AppError("İşlenmiş belge arşivlenemez", 409);
      await tx.document.update({ where: { id }, data: { archived: true } });
    } else {
      const archivedRecord = await ref(tx, a, id, kind);
      if (["customers","suppliers"].includes(kind) && (
        await tx.financialInvoice.count({where:{orgId:a.orgId,partyId:id}}) ||
        await tx.financePayment.count({where:{orgId:a.orgId,partyId:id}}) ||
        await tx.journalLine.count({where:{orgId:a.orgId,partyId:id}})
      )) throw new AppError("Finansal hareketi olan cari arşivlenemez.",409);
      if (["customers", "projects"].includes(kind)) {
        const key = kind === "customers" ? "customerId" : "projectId";
        if (
          await tx.record.count({
            where: {
              orgId: a.orgId,
              archived: false,
              data: { path: [key], equals: id },
            },
          })
        )
          throw new AppError(
            "Bağlı aktif kayıtları olan kayıt arşivlenemez.",
            409,
          );
      }
      if (["products", "warehouses", "customers", "suppliers"].includes(kind)) {
        const used = await tx.document.count({
          where: {
            orgId: a.orgId,
            OR: [
              { contactId: id },
              { warehouseId: id },
              { lines: { some: { productId: id } } },
            ],
          },
        });
        const stocked = await tx.stock.count({
          where: {
            orgId: a.orgId,
            quantity: { not: 0 },
            OR: [{ productId: id }, { warehouseId: id }],
          },
        });
        if (used || stocked)
          throw new AppError("İşlemlerde kullanılan kayıt arşivlenemez.", 409);
      }
      await tx.record.update({
        where: { id },
        data: { archived: true, version: { increment: 1 } },
      });
      if (kind === "tasks")
        await recalculateProject(
          tx,
          a,
          String(
            (archivedRecord.data as Record<string, string>).projectId ?? "",
          ),
        );
    }
    await audit(tx, a, "ARCHIVE " + kind, id);
    return { ok: true };
  });
}
