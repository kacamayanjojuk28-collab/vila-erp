import { cookies, headers } from "next/headers";
import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { canWrite } from "./permissions";
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
function derive(value: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(value, salt, 64, { N: 16384 },
    (error, key) => error ? reject(error) : resolve(key)));
}
export async function passwordHash(value: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + (await derive(value, salt)).toString("hex");
}
export async function passwordCheck(value: string, stored: string) {
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored)) return false;
  const [salt, h] = stored.split(":");
  return timingSafeEqual(await derive(value, salt), Buffer.from(h, "hex"));
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
  if (!membership || !membership.active)
    throw new AppError("Şirket erişimi kaldırılmış.", 403);
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
  if (!canWrite(a.role, scope))
    throw new AppError("Bu işlem için yetkiniz yok.", 403);
}
export async function loginSession(userId: string, orgId: string) {
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? "";
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
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key","count","until") VALUES (${key},1,clock_timestamp()+interval '10 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "count"=CASE WHEN "RateLimit"."until" <= clock_timestamp() THEN 1 ELSE "RateLimit"."count"+1 END,
      "until"=CASE WHEN "RateLimit"."until" <= clock_timestamp() THEN clock_timestamp()+interval '10 minutes' ELSE "RateLimit"."until" END
    RETURNING "count"`;
  if (rows[0].count > limit)
    throw new AppError(
      "Çok fazla deneme. 10 dakika sonra tekrar deneyin.",
      429,
    );
}
