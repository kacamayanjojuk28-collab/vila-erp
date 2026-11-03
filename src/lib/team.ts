import { z } from "zod";
import { db } from "./db";
import { AppError, authorize, type Actor } from "./security";
import { transaction, audit } from "./service";
const input = z
  .object({
    role: z
      .enum(["ADMIN", "SALES", "WAREHOUSE", "FINANCE", "MEMBER", "VIEWER"])
      .optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (v) => v.role !== undefined || v.active !== undefined,
    "Rol veya erişim durumu gerekli",
  );
export async function updateMember(a: Actor, id: string, body: unknown) {
  authorize(a, "settings");
  const v = input.parse(body);
  return transaction(async (tx) => {
    const m = await tx.membership.findFirst({ where: { id, orgId: a.orgId } });
    if (!m) throw new AppError("Üyelik bulunamadı", 404);
    if (m.role === "OWNER" || m.userId === a.userId)
      throw new AppError(
        "Şirket sahibinin veya kendi erişiminizi değiştiremezsiniz.",
        403,
      );
    if (a.role !== "OWNER" && (m.role === "ADMIN" || v.role === "ADMIN"))
      throw new AppError(
        "Yönetici erişimini yalnızca şirket sahibi değiştirebilir.",
        403,
      );
    await tx.membership.update({ where: { id }, data: v });
    if (v.active === false || v.role !== undefined)
      await tx.session.deleteMany({
        where: { userId: m.userId, orgId: a.orgId },
      });
    await audit(
      tx,
      a,
      v.active === false
        ? "SUSPEND MEMBER"
        : v.active === true
          ? "RESTORE MEMBER"
          : "CHANGE ROLE",
      id,
      {
        before: { role: m.role, active: m.active },
        after: { role: v.role ?? m.role, active: v.active ?? m.active },
      },
    );
    return { ok: true };
  });
}
export async function revokeInvite(a: Actor, id: string) {
  authorize(a, "settings");
  return transaction(async (tx) => {
    const r = await tx.invite.updateMany({
      where: { id, orgId: a.orgId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!r.count) throw new AppError("Davet bulunamadı veya kullanılmış.", 404);
    await audit(tx, a, "REVOKE INVITE", id);
    return { ok: true };
  });
}
export async function sessions(a: Actor) {
  const rows = await db.session.findMany({
    where: { userId: a.userId, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      orgId: true,
      createdAt: true,
      expiresAt: true,
      userAgent: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ ...r, current: r.id === a.sessionId }));
}
export async function revokeSession(a: Actor, id: string) {
  if (id === a.sessionId)
    throw new AppError("Mevcut oturum için Oturumu kapat düğmesini kullanın.");
  return transaction(async (tx) => {
    const r = await tx.session.deleteMany({ where: { id, userId: a.userId } });
    if (!r.count) throw new AppError("Oturum bulunamadı", 404);
    await audit(tx, a, "REVOKE SESSION", a.userId);
    return { ok: true };
  });
}
