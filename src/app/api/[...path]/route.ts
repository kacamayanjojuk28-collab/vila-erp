import { handleFinanceCore } from "@/lib/finance-api";
import { canRead } from "@/lib/permissions";
import { beginLogin, finishLogin } from "@/lib/login-limit";
import {validateEndpoint} from "@/lib/api-contract";
import {idempotent} from "@/lib/idempotency";
import {
  updateMember,
  revokeInvite,
  sessions,
  revokeSession,
} from "@/lib/team";
import { db, withTenant, setTransactionTenant } from "@/lib/db";
import {
  decimal,
  documentKinds,
  money,
  qty,
  recordSchemas,
} from "@/lib/domain";
import {
  AppError,
  authorize,
  hash,
  loginSession,
  originCheck,
  passwordCheck,
  passwordHash,
  rateLimit,
  session,
} from "@/lib/security";
import {
  adjustStock,
  archive,
  audit,
  saveDocument,
  saveRecord,
  transaction,
  workflow,
} from "@/lib/service";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
export const runtime = "nodejs";
const credentials = z.object({
  email: z.email().transform((s) => s.toLowerCase()),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(2).max(100).optional(),
  company: z.string().trim().min(2).max(100).optional(),
  invite: z.string().optional(),
});
async function handler(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    if(path[0]!=="finance-core") validateEndpoint(path, req.method);
    const [kind, id, action] = path;
    const url = new URL(req.url);
    const write = req.method !== "GET";
    if (write) originCheck(req);
    let body: any = {};
    if (write && req.method !== "DELETE") {
      const raw = await req.text();
      if (raw.length > 100000) throw new AppError("İstek çok büyük", 413);
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        throw new AppError("Geçersiz JSON isteği.", 400);
      }
    }
    if(kind === "finance-core") { const actor=await session(); if(write)await rateLimit("write:"+actor.userId,600); return await withTenant(actor.orgId,()=>handleFinanceCore(req,path.slice(1),body,actor,url)); }
    if (kind === "auth" && write) {
      if (id === "logout") {
        const a = await session();
        await db.session.delete({ where: { id: a.sessionId } });
        (await cookies()).delete("vila_session");
        return NextResponse.json({ ok: true });
      }
      const v = credentials.parse(body);
      if (id === "register") await rateLimit("register:" + hash(v.email), 15);
      if (id === "register") {
        if (!v.name || (!v.company && !v.invite))
          throw new AppError("Adınız ve şirket adı gerekli.");
        const result = await transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: v.email,
              name: v.name!,
              password: await passwordHash(v.password),
            },
          });
          let orgId: string;
          if (v.invite) {
            const invitation = await tx.invite.findUnique({
              where: { token: hash(v.invite) },
            });
            if (
              !invitation ||
              invitation.email !== v.email ||
              invitation.expiresAt < new Date() ||
              invitation.acceptedAt ||
              invitation.revokedAt
            )
              throw new AppError("Davet geçersiz veya süresi dolmuş");
            orgId = invitation.orgId;
            await tx.membership.create({
              data: { orgId, userId: user.id, role: invitation.role },
            });
            await tx.invite.update({
              where: { id: invitation.id },
              data: { acceptedAt: new Date() },
            });
          } else {
            const org = await tx.organization.create({
              data: { name: v.company! },
            });
            orgId = org.id;
            await tx.membership.create({
              data: { userId: user.id, orgId, role: "OWNER" },
            });
          }
          await setTransactionTenant(tx, orgId);
          await tx.audit.create({
            data: {
              orgId,
              userId: user.id,
              action: "REGISTER",
              entityId: user.id,
            },
          });
          return { userId: user.id, orgId };
        });
        await loginSession(result.userId, result.orgId);
        return NextResponse.json({ ok: true });
      }
      if (id === "login") {
        const attempt = await beginLogin(req, v.email);
        const user = await db.user.findUnique({
          where: { email: v.email },
          include: { memberships: { where: { active: true } } },
        });
        const fallback = "00000000000000000000000000000000:" + "00".repeat(64);
        const valid = await passwordCheck(v.password, user?.password ?? fallback);
        await finishLogin(attempt, !!user && valid && !!user.memberships[0]);
        if (!user || !valid || !user.memberships[0])
          throw new AppError("E-posta veya parola hatalı.", 401);
        let orgId = user.memberships[0].orgId;
        if (v.invite) {
          orgId = await transaction(async (tx) => {
            const invite = await tx.invite.findUnique({
              where: { token: hash(v.invite!) },
            });
            if (
              !invite ||
              invite.email !== user.email ||
              invite.acceptedAt ||
              invite.revokedAt ||
              invite.expiresAt < new Date()
            )
              throw new AppError("Davet geçersiz");
            const membership = await tx.membership.upsert({
              where: { orgId_userId: { orgId: invite.orgId, userId: user.id } },
              create: {
                orgId: invite.orgId,
                userId: user.id,
                role: invite.role,
              },
              update: {},
            });
            if (!membership.active)
              throw new AppError("Şirket erişiminiz askıya alınmış.", 403);
            await tx.invite.update({
              where: { id: invite.id },
              data: { acceptedAt: new Date() },
            });
            return invite.orgId;
          });
        }
        await loginSession(user.id, orgId);
        return NextResponse.json({ ok: true });
      }
      throw new AppError("Geçersiz işlem", 404);
    }
    if (kind === "health" && !write) {
      await db.$queryRaw`SELECT 1`;
      return NextResponse.json({ status: "ok", database: "postgresql" });
    }
    const a = await session();
    return await withTenant(a.orgId, async () => {
    if (!write && !canRead(a.role, kind)) throw new AppError("Bu işlem için yetkiniz yok.", 403);
    if (write) await rateLimit("write:" + a.userId, 600);
    if (kind === "me" && !write) {
      const members = await db.membership.findMany({
        where: { orgId: a.orgId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      const orgs = await db.membership.findMany({
        where: { userId: a.userId, active: true },
        include: { org: true },
      });
      return NextResponse.json({
        user: { id: a.userId, name: a.user.name, email: a.user.email },
        org: a.org,
        role: a.role,
        members,
        orgs,
        pendingInvites: ["OWNER", "ADMIN"].includes(a.role)
          ? await db.invite.findMany({
              where: {
                orgId: a.orgId,
                acceptedAt: null,
                revokedAt: null,
                expiresAt: { gt: new Date() },
              },
              select: { id: true, email: true, role: true, expiresAt: true },
            })
          : [],
      });
    }
    if (kind === "organization" && write) {
      authorize(a, "settings");
      const v = z
        .object({
          name: z.string().trim().min(2).max(100),
          currency: z.enum(["TRY", "USD", "EUR"]),
          locale: z.enum(["tr-TR", "en-US"]),
          notifications: z.boolean(),
        })
        .parse(body);
      const result = await transaction(async (tx) => {
        if (
          v.currency !== a.org.currency &&
          ((await tx.journalEntry.count({where:{orgId:a.orgId}})) ||
          (await tx.document.count({ where: { orgId: a.orgId } })) ||
            (await tx.payment.count({ where: { orgId: a.orgId } })))
        )
          throw new AppError(
            "Finansal kayıt varken şirket para birimi değiştirilemez.",
            409,
          );
        const r = await tx.organization.update({
          where: { id: a.orgId },
          data: {
            name: v.name,
            currency: v.currency,
            locale: v.locale,
            settings: { notifications: v.notifications },
          },
        });
        await audit(tx, a, "UPDATE ORGANIZATION", a.orgId);
        return r;
      });
      return NextResponse.json(result);
    }
    if (kind === "password" && write) {
      await rateLimit("password:" + a.userId, 5);
      const v = z
        .object({
          currentPassword: z.string().max(128),
          newPassword: z.string().min(12).max(128),
        })
        .parse(body);
      if (!(await passwordCheck(v.currentPassword, a.user.password)))
        throw new AppError("Mevcut parola hatalı", 400);
      await transaction(async (tx) => {
        await tx.user.update({
          where: { id: a.userId },
          data: { password: await passwordHash(v.newPassword) },
        });
        await tx.session.deleteMany({
          where: { userId: a.userId, id: { not: a.sessionId } },
        });
        await audit(tx, a, "PASSWORD CHANGED", a.userId);
      });
      return NextResponse.json({ ok: true });
    }
    if (kind === "profile" && write) {
      const v = z
        .object({ name: z.string().trim().min(2).max(100) })
        .parse(body);
      await transaction(async (tx) => {
        await tx.user.update({ where: { id: a.userId }, data: v });
        await audit(tx, a, "UPDATE PROFILE", a.userId);
      });
      return NextResponse.json({ ok: true });
    }
    if (kind === "switch" && write) {
      const v = z.object({ orgId: z.string() }).parse(body);
      if (
        !(await db.membership.findFirst({
          where: { orgId: v.orgId, userId: a.userId, active: true },
        }))
      )
        throw new AppError("Yetkisiz şirket", 403);
      await db.session.update({
        where: { id: a.sessionId },
        data: { orgId: v.orgId },
      });
      return NextResponse.json({ ok: true });
    }
    if (kind === "invites" && req.method === "DELETE")
      return NextResponse.json(await revokeInvite(a, id));
    if (kind === "invites" && write) {
      authorize(a, "settings");
      const v = z
        .object({
          email: z.email().transform((s) => s.toLowerCase()),
          role: z.enum([
            "ADMIN",
            "SALES",
            "WAREHOUSE",
            "FINANCE",
            "MEMBER",
            "VIEWER",
          ]),
        })
        .parse(body);
      if (v.role === "ADMIN" && a.role !== "OWNER")
        throw new AppError(
          "Yönetici davetini yalnızca şirket sahibi oluşturabilir.",
          403,
        );
      const token = randomBytes(32).toString("hex");
      await transaction(async (tx) => {
        await tx.invite.create({
          data: {
            ...v,
            orgId: a.orgId,
            token: hash(token),
            expiresAt: new Date(Date.now() + 7 * 86400000),
          },
        });
        await audit(tx, a, "INVITE", v.email, { role: v.role });
      });
      return NextResponse.json({
        url: (process.env.APP_ORIGIN ?? url.origin) + "/?invite=" + token,
      });
    }
    if (kind === "members" && write)
      return NextResponse.json(await updateMember(a, id, body));
    if (kind === "sessions" && !write)
      return NextResponse.json(await sessions(a));
    if (kind === "sessions" && req.method === "DELETE")
      return NextResponse.json(await revokeSession(a, id));
    if (kind === "lookup" && !write) {
      const records = await db.record.findMany({
        where: {
          orgId: a.orgId,
          archived: false,
          kind: {
            in: [
              "customers",
              "suppliers",
              "products",
              "warehouses",
              "projects",
            ],
          },
        },
        orderBy: { name: "asc" },
        take: 2000,
      });
      return NextResponse.json(records);
    }
    if (kind === "dashboard" && !write) {
      const compact = url.searchParams.get("view") === "summary";
      const finance = canRead(a.role, "finance");
      const from = url.searchParams.get("from"),
        to = url.searchParams.get("to");
      const dateRange: any = {};
      if (from) dateRange.gte = z.coerce.date().parse(from);
      if (to) {
        const d = z.coerce.date().parse(to);
        d.setUTCHours(23, 59, 59, 999);
        dateRange.lte = d;
      }
      if(dateRange.gte && dateRange.lte && dateRange.gte > dateRange.lte)throw new AppError("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
      const where = { orgId: a.orgId, createdAt: dateRange };
      const [records, documents, payments, stocks, activities] =
        await Promise.all([
          db.record.findMany({ where: { orgId: a.orgId, archived: false } }),
          db.document.findMany({
            where: { ...where, archived: false, kind: { in: documentKinds.filter(k => canRead(a.role, k)) } },
            ...(compact ? { select: { kind: true, status: true, contactId: true, total: true, paid: true, createdAt: true, dueDate: true } } : {}),
          }),
          !finance ? Promise.resolve([]) : compact
            ? db.$queryRaw<{createdAt: Date; direction: string; amount: Prisma.Decimal}[]>`
                SELECT date_trunc('month', "createdAt") AS "createdAt", direction, sum(amount) AS amount
                FROM "Payment" WHERE "orgId"=${a.orgId}
                AND "createdAt">=${dateRange.gte ?? new Date("0001-01-01T00:00:00Z")}
                AND "createdAt"<=${dateRange.lte ?? new Date("9999-12-31T23:59:59.999Z")}
                GROUP BY date_trunc('month', "createdAt"), direction
                ORDER BY "createdAt", direction`
            : db.payment.findMany({ where }),
          db.stock.findMany({ where: { orgId: a.orgId } }),
          canRead(a.role, "audit") ? db.audit.findMany({ where, select:{id:true,action:true,createdAt:true}, orderBy: { createdAt: "desc" }, take: 8 }) : Promise.resolve([]),
        ]);
      const income = payments
        .filter((p) => p.direction === "IN")
        .reduce((s, p) => s.add(p.amount), decimal(0));
      const expense = payments
        .filter((p) => p.direction === "OUT")
        .reduce((s, p) => s.add(p.amount), decimal(0));
      const outstanding = (kind: string) =>
        documents
          .filter((d) => d.kind === kind && d.status !== "DRAFT")
          .reduce((sum, d) => sum.add(d.total).minus(d.paid), decimal(0));
      const recordNames = new Map(records.map(r => [r.id, r.name]));
      const group = (kind: string) => {
        const groups = new Map<
          string,
          {
            name: string;
            count: number;
            fulfilled: number;
            total: Prisma.Decimal;
            paid: Prisma.Decimal;
          }
        >();
        for (const d of documents.filter((d) => d.kind === kind)) {
          const r = groups.get(d.contactId) ?? {
            name:
              recordNames.get(d.contactId) ?? d.contactId,
            count: 0,
            fulfilled: 0,
            total: decimal(0),
            paid: decimal(0),
          };
          r.count++;
          r.total = r.total.add(d.total);
          r.paid = r.paid.add(d.paid);
          if (d.status === "FULFILLED") r.fulfilled++;
          groups.set(d.contactId, r);
        }
        return [...groups.values()];
      };
      const aging = [0, 1, 2, 3].map((i) => ({
        label: ["0–30 gün", "31–60 gün", "61–90 gün", "90+ gün"][i],
        amount: decimal(0),
        count: 0,
      }));
      for (const d of documents.filter(
        (d) => d.kind === "sales" && d.status !== "DRAFT" && d.total.gt(d.paid),
      )) {
        const age = Math.floor((Date.now() - d.createdAt.getTime()) / 86400000),
          i = age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3;
        aging[i].amount = aging[i].amount.add(d.total).minus(d.paid);
        aging[i].count++;
      }
      const overdue = documents
        .filter(
          (d) =>
            d.kind === "sales" &&
            d.status !== "DRAFT" &&
            d.dueDate &&
            d.dueDate < new Date(),
        )
        .reduce((sum, d) => sum.add(d.total).minus(d.paid), decimal(0));
      const financialFields = finance ? {
        aging, overdue, receivable: outstanding("sales"), payable: outstanding("purchases"),
        net: income.minus(expense), income, expense,
        ...(compact ? {monthlyPayments: payments} : {payments}),
      } : {};
      return NextResponse.json({
        ...financialFields,
        /* Legacy financial fields are supplied only through financialFields. */
                reports: { ...(canRead(a.role, "sales") ? {sales: group("sales")} : {}), ...(canRead(a.role, "purchases") ? {purchases: group("purchases")} : {}) },
        ...(compact ? {
          records: records.filter(r => ["deals", "tasks", "projects", "products", "activities"].includes(r.kind)),

        } : { records, documents }),
        stocks,
        activities,
      });
    }
    if (kind === "history" && !write) {
      const contact = await db.record.findFirst({
        where: { id, orgId: a.orgId, kind: "customers", archived: false },
      });
      if (!contact) throw new AppError("Müşteri bulunamadı", 404);
      const [activities, documents, deals] = await Promise.all([
        db.record.findMany({
          where: {
            orgId: a.orgId,
            kind: "activities",
            archived: false,
            data: { path: ["customerId"], equals: id },
          },
          orderBy: { createdAt: "desc" },
        }),
        db.document.findMany({
          where: { orgId: a.orgId, contactId: id, archived: false, kind: { in: documentKinds.filter(k => canRead(a.role, k)) } },
          include: { lines: true },
          orderBy: { createdAt: "desc" },
        }),
        db.record.findMany({
          where: {
            orgId: a.orgId,
            kind: "deals",
            archived: false,
            data: { path: ["customerId"], equals: id },
          },
        }),
      ]);
      return NextResponse.json({ contact, activities, documents, deals });
    }
    if (kind === "leads" && action === "convert" && write) {
      authorize(a, "leads");
      authorize(a, "customers");
      const result = await transaction(async (tx) => {
        const lead = await tx.record.findFirst({
          where: { id, orgId: a.orgId, kind: "leads", archived: false },
        });
        if (!lead) throw new AppError("Potansiyel müşteri bulunamadı", 404);
        const data = lead.data as Record<string, string>;
        const customer = await tx.record.create({
          data: {
            orgId: a.orgId,
            kind: "customers",
            name: lead.name,
            data: {
              company: data.company,
              email: data.email,
              phone: data.phone,
              notes: data.notes,
              segment: "SMB",
            },
          },
        });
        await tx.record.update({
          where: { id },
          data: { archived: true, version: { increment: 1 } },
        });
        await audit(tx, a, "CONVERT LEAD", id, { customerId: customer.id });
        return customer;
      });
      return NextResponse.json(result);
    }
    const page = Math.max(
      1,
      Math.min(10000, Math.floor(Number(url.searchParams.get("page"))) || 1),
    );
    const take = 12;
    const q = (url.searchParams.get("q") ?? "").slice(0, 100);
    const status = url.searchParams.get("status");
    const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
    const sort = ["name", "createdAt", "status"].includes(
      url.searchParams.get("sort") ?? "",
    )
      ? url.searchParams.get("sort")!
      : "createdAt";
    if (["stock", "movements", "finance", "audit"].includes(kind) && !write) {
      let rows: unknown[], total: number;
      const base = { orgId: a.orgId };
      const productIds = q
        ? (
            await db.record.findMany({
              where: {
                orgId: a.orgId,
                kind: "products",
                name: { contains: q, mode: "insensitive" },
              },
              select: { id: true },
            })
          ).map((r) => r.id)
        : undefined;
      const stockWhere = {
        ...base,
        ...(productIds ? { productId: { in: productIds } } : {}),
      };
      if (kind === "stock") {
        rows = await db.stock.findMany({
          where: stockWhere,
          orderBy: { quantity: order },
          skip: (page - 1) * take,
          take,
        });
        total = await db.stock.count({ where: stockWhere });
      } else if (kind === "movements") {
        rows = await db.movement.findMany({
          where: stockWhere,
          orderBy: { createdAt: order },
          skip: (page - 1) * take,
          take,
        });
        total = await db.movement.count({ where: stockWhere });
      } else if (kind === "finance") {
        const where = {
          ...base,
          name: { contains: q, mode: "insensitive" as const },
        };
        rows = await db.payment.findMany({
          where,
          orderBy: { [sort === "name" ? "name" : "createdAt"]: order },
          skip: (page - 1) * take,
          take,
        });
        total = await db.payment.count({ where });
      } else {
        authorize(a, "settings");
        const where = {
          ...base,
          action: { contains: q, mode: "insensitive" as const },
        };
        rows = await db.audit.findMany({
          where,
          orderBy: { createdAt: order },
          skip: (page - 1) * take,
          take,
        });
        total = await db.audit.count({ where });
      }
      return NextResponse.json({
        rows,
        total,
        page,
        pages: Math.ceil(total / take),
      });
    }
    if (kind === "stock" && write) {
      authorize(a, "stock");
      const v = z
        .object({
          productId: z.string(),
          warehouseId: z.string(),
          targetWarehouseId: z.string().optional(),
          quantity: qty,
          direction: z.enum(["IN", "OUT", "TRANSFER"]),
          reason: z.string().trim().min(3).max(200),
        })
        .parse(body);
      await idempotent(a,"stock",req.headers.get("Idempotency-Key"),v,async (tx) => {
        await adjustStock(
          tx,
          a,
          v.productId,
          v.warehouseId,
          v.direction === "IN"
            ? decimal(v.quantity)
            : decimal(v.quantity).negated(),
          v.reason,
        );
        if (v.direction === "TRANSFER") {
          if (!v.targetWarehouseId || v.targetWarehouseId === v.warehouseId)
            throw new AppError("Farklı hedef depo seçin");
          await adjustStock(
            tx,
            a,
            v.productId,
            v.targetWarehouseId,
            decimal(v.quantity),
            v.reason,
          );
        }
        await audit(tx, a, "STOCK " + v.direction, v.productId);
        return {ok:true};
      });
      return NextResponse.json({ ok: true });
    }
    if (kind === "finance" && id && action === "reverse" && write) {
      authorize(a, "finance");
      if(await db.financePayment.findFirst({where:{orgId:a.orgId,id}}))throw new AppError("Bu ödeme Finance Core üzerinden ters çevrilmelidir.",409);
      const v = z
        .object({ reason: z.string().trim().min(3).max(160) })
        .parse(body);
      const result = await transaction(async (tx) => {
        const original = await tx.payment.findFirst({
          where: { id, orgId: a.orgId },
        });
        if (
          !original ||
          original.reversalOf ||
          (await tx.payment.findUnique({ where: { reversalOf: id } }))
        )
          throw new AppError("Bu kayıt ters çevrilemez.", 409);
        if (original.documentId) {
          const d = await tx.document.updateMany({
            where: {
              id: original.documentId,
              orgId: a.orgId,
              paid: { gte: original.amount },
            },
            data: { paid: { decrement: original.amount } },
          });
          if (d.count !== 1) throw new AppError("Belge bakiyesi geçersiz", 409);
        }
        const r = await tx.payment.create({
          data: {
            orgId: a.orgId,
            name: "Ters kayıt: " + v.reason,
            direction: original.direction === "IN" ? "OUT" : "IN",
            amount: original.amount,
            documentId: original.documentId,
            reversalOf: id,
          },
        });
        await audit(tx, a, "PAYMENT REVERSED", id, {
          reason: v.reason,
          reversalId: r.id,
        });
        return r;
      });
      return NextResponse.json(result);
    }
    if (kind === "finance" && write) {
      authorize(a, "finance");
      const v = z
        .object({
          name: z.string().trim().min(1).max(160),
          direction: z.enum(["IN", "OUT"]),
          amount: money.refine((v) => decimal(v).gt(0)),
          documentId: z.string().optional(),
        })
        .parse(body);
      const result = await idempotent(a,"finance",req.headers.get("Idempotency-Key"),v,async (tx) => {
        if (v.documentId) {
          const d = await tx.document.findFirst({
            where: {
              id: v.documentId,
              orgId: a.orgId,
              archived: false,
              status: "FULFILLED",
              kind: v.direction === "IN" ? "sales" : "purchases",
            },
          });
          if (!d || d.total.minus(d.paid).lt(v.amount))
            throw new AppError("Belge veya kalan tutar geçersiz", 409);
          await tx.document.update({
            where: { id: d.id },
            data: { paid: { increment: decimal(v.amount) } },
          });
        }
        const r = await tx.payment.create({
          data: { ...v, documentId: v.documentId || null, orgId: a.orgId },
        });
        await audit(tx, a, "PAYMENT " + v.direction, r.id);
        return r;
      });
      return NextResponse.json(result);
    }
    if (!recordSchemas[kind] && !documentKinds.includes(kind))
      throw new AppError("Modül bulunamadı", 404);
    if (
      !write &&
      action === "deliveries" &&
      ["sales", "purchases"].includes(kind)
    ) {
      const document = await db.document.findFirst({
        where: { id, orgId: a.orgId, kind, archived: false },
        select: { id: true },
      });
      if (!document) throw new AppError("Belge bulunamadı", 404);
      return NextResponse.json(
        await db.audit.findMany({
          where: { orgId: a.orgId, entityId: id, action: "FULFILL " + kind },
          select: { id: true, createdAt: true, detail: true },
          orderBy: { createdAt: "desc" },
        }),
      );
    }
    if (!write) {
      const where = {
        orgId: a.orgId,
        kind,
        archived: false,
        name: { contains: q, mode: "insensitive" as const },
        ...(status ? { status } : {}),
      };
      const model = documentKinds.includes(kind) ? "document" : "record";
      if (model === "document") {
        const [rows, total] = await Promise.all([
          db.document.findMany({
            where,
            include: { lines: true },
            orderBy: { [sort]: order },
            skip: (page - 1) * take,
            take,
          }),
          db.document.count({ where }),
        ]);
        return NextResponse.json({
          rows,
          total,
          page,
          pages: Math.ceil(total / take),
        });
      }
      const [rows, total] = await Promise.all([
        db.record.findMany({
          where,
          orderBy: { [sort]: order },
          skip: (page - 1) * take,
          take,
        }),
        db.record.count({ where }),
      ]);
      return NextResponse.json({
        rows,
        total,
        page,
        pages: Math.ceil(total / take),
      });
    }
    if (req.method === "DELETE")
      return NextResponse.json(await archive(a, kind, id));
    if (action) {
      if (req.method !== "POST")
        throw new AppError("Bu işlem POST gerektirir.", 405);
      return NextResponse.json(await workflow(a, kind, id, action, body));
    }
    return NextResponse.json(
      documentKinds.includes(kind)
        ? await saveDocument(a, kind, body, id)
        : await saveRecord(a, kind, body, id),
    );
    });
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json(
        {
          error: e.issues
            .map((i) => i.path.join(".") + ": " + i.message)
            .join("; "),
        },
        { status: 400 },
      );
    if (e instanceof AppError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return NextResponse.json(
        { error: "Bu e-posta, SKU veya işlem zaten kayıtlı." },
        { status: 409 },
      );
    console.error(
      "VILA request failed",
      e instanceof Error ? e.name : "unknown",
    );
    return NextResponse.json(
      { error: "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
export { handler as DELETE, handler as GET, handler as PATCH, handler as POST };
