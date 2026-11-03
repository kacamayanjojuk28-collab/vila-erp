import { isIP } from "node:net";
import { timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { hash, rateLimit } from "./security";

export function loginAddress(req: Request) {
  // Enable only behind a proxy that strips these headers from incoming traffic
  // and injects its own token and one canonical client address. Never log token.
  const expected = process.env.VILA_TRUSTED_PROXY_SECRET;
  const supplied = req.headers.get("x-vila-proxy-token") ?? "";
  const address = req.headers.get("x-forwarded-for") ?? "";
  if (expected && expected.length >= 32 && Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)) && isIP(address)) return address;
  // Next Request exposes no socket peer. Unverified clients share a conservative
  // server budget; a spoofable header must never create extra buckets.
  return "unverified";
}
export async function beginLogin(req: Request, email: string) {
  const address = loginAddress(req), account = hash(email);
  await rateLimit("login-ip:" + hash(address), address === "unverified" ? 300 : 120);
  const pair = "login-pair:" + hash(address + ":" + account);
  // Atomic reservations also bound concurrent password derivations per pair.
  await rateLimit(pair, 20);
  return { pair, account };
}
export async function finishLogin(attempt: { pair: string; account: string }, valid: boolean) {
  if (valid) {
    // Release only this successful reservation; never erase concurrent failures.
    await db.$executeRaw`UPDATE "RateLimit" SET "count"=GREATEST(0,"count"-1) WHERE "key"=${attempt.pair}`;
  } else {
    // Distributed attacks get a second account-wide limit. Correct credentials
    // bypass this failure budget, preventing a remote account-lockout attack.
    await rateLimit("login-account:" + attempt.account, 30);
  }
}
