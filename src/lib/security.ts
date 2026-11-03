import { cookies, headers } from "next/headers";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { db } from "./db";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export function passwordHash(value: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(value, salt, 64, { N: 16384 }).toString("hex");
}
export function passwordCheck(value: string, stored: string) {
  const [salt, h] = stored.split(":");
  const a = scryptSync(value, salt, 64, { N: 16384 });
  const b = Buffer.from(h, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function session() {
  const token = (await cookies()).get("vila_session")?.value;
  if (!token) throw new AppError("Oturum açmanız gerekiyor.", 401);
  const s = await db.session.findUnique({
    where: { id: hash(token) },
    include: { user: true },
  });
  if (!s || s.expiresAt < new Date())
    throw new AppError("Oturum süresi doldu.", 401);
  const membership = await db.membership.findUnique({
    where: { orgId_userId: { orgId: s.orgId, userId: s.userId } },
    include: { org: true },
  });
  if (!membership || !membership.active) throw new AppError("Şirket erişimi kaldırılmış.", 403);
  return {
    user: s.user,
    org: membership.org,
    orgId: s.orgId,
    userId: s.userId,
    role: membership.role,
    sessionId: s.id,
  };
}
export type Actor = Awaited<ReturnType<typeof session>>;
export function authorize(a: Actor, scope: string) {
  const roles: Record<string, string[]> = {
    OWNER: ["*"],
    ADMIN: ["*"],
    SALES: ["customers", "leads", "deals", "quotes", "sales", "activities"],
    WAREHOUSE: [
      "products",
      "warehouses",
      "stock",
      "purchases",
      "requests",
      "suppliers",
    ],
    FINANCE: ["finance"],
    MEMBER: ["projects", "tasks", "activities"],
    VIEWER: [],
  };
  if (!roles[a.role]?.some((x) => x === "*" || x === scope))
    throw new AppError("Bu işlem için yetkiniz yok.", 403);
}
export async function loginSession(userId: string, orgId: string) {
  const userAgent=(await headers()).get("user-agent")?.slice(0,300)??"";
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      id: hash(token),
      userId,
      orgId,
      userAgent,
      expiresAt: new Date(Date.now() + 86400000 * 7),
    },
  });
  (await cookies()).set("vila_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
    path: "/",
    maxAge: 604800,
  });
}
export function originCheck(req: Request) {
  const origin = req.headers.get("origin");
  const allowed = process.env.APP_ORIGIN ?? "http://localhost:3000";
  if (origin !== allowed) throw new AppError("Geçersiz istek kaynağı.", 403);
}
export async function rateLimit(key: string, limit = 20) {
  const now = new Date();
  const row = await db.$transaction(async (tx) => {
    await tx.rateLimit.deleteMany({ where: { key, until: { lt: now } } });
    return tx.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, until: new Date(Date.now() + 600000) },
      update: { count: { increment: 1 } },
    });
  });
  if (row.count > limit)
    throw new AppError(
      "Çok fazla deneme. 10 dakika sonra tekrar deneyin.",
      429,
    );
}
