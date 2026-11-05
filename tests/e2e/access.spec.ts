import "dotenv/config";
import {db} from "../../src/lib/db";
import { request } from "../company-request";
import {
  test,
  expect,
  type APIRequestContext } from "@playwright/test";
import { randomBytes } from "node:crypto";
test("Access lifecycle: suspension, revoked invitations and session ownership", async () => {
  const origin = (process.env.VILA_TEST_ORIGIN || "http://localhost:3000"),
    password = randomBytes(20).toString("hex"),
    stamp = Date.now();
  const contexts: APIRequestContext[] = [];
  const ctx = async () => {
    const c = await request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: origin },
    });
    contexts.push(c);
    return c;
  };
  const post = async (c: APIRequestContext, p: string, data: any) => {
    const r = await c.post("/api/" + p, { data });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  };
  try {
    const owner = await ctx(),
      member = await ctx(),
      second = await ctx();
    await post(owner, "auth/register", {
      email: `access-owner${stamp}@example.test`,
      password,
      name: "Access Owner",
      company: "Access test",
    });
    const email = `access-member${stamp}@example.test`;
    const invitation = await post(owner, "invites", { email, role: "MEMBER" });
    await post(member, "auth/register", {
      email,
      password,
      name: "Access Member",
      invite: new URL(invitation.url).searchParams.get("invite"),
    });
    await post(second, "auth/login", { email, password });
    expect((await owner.post('/api/profile',{data:'{bad',headers:{'Content-Type':'application/json'}})).status()).toBe(400);
    expect((await owner.get('/api/customers?page=1.5')).status()).toBe(200);
    const me = await (await owner.get("/api/me")).json();
    await db.organization.update({where:{id:me.org.id},data:{demo:true}});
    const target = me.members.find((m: any) => m.user.email === email);
    const own = me.members.find((m: any) => m.role === "OWNER");
    expect(
      (
        await owner.patch("/api/members/" + own.id, { data: { active: false } })
      ).status(),
    ).toBe(403);
    const sessions = await (await second.get("/api/sessions")).json();
    const otherSession = sessions.find((s: any) => !s.current);
    expect(
      (await owner.delete("/api/sessions/" + otherSession.id)).status(),
    ).toBe(404);
    expect(
      (await second.delete("/api/sessions/" + otherSession.id)).status(),
    ).toBe(200);
    expect((await member.get("/api/me")).status()).toBe(401);
    expect(
      (
        await owner.patch("/api/members/" + target.id, {
          data: { active: false },
        })
      ).status(),
    ).toBe(200);
    expect((await second.get("/api/me")).status()).toBe(401);
    expect(
      (
        await member.post("/api/auth/login", { data: { email, password } })
      ).status(),
    ).toBe(401);
    expect(
      (
        await owner.patch("/api/members/" + target.id, {
          data: { active: true },
        })
      ).status(),
    ).toBe(200);
    await post(member, "auth/login", { email, password });
    expect((await member.get("/api/me")).status()).toBe(200);
    const revokedEmail = `revoked${stamp}@example.test`;
    const revoked = await post(owner, "invites", {
      email: revokedEmail,
      role: "VIEWER",
    });
    const pending = (
      await (await owner.get("/api/me")).json()
    ).pendingInvites.find((i: any) => i.email === revokedEmail);
    expect((await owner.delete("/api/invites/" + pending.id)).status()).toBe(
      200,
    );
    const denied = await (
      await ctx()
    ).post("/api/auth/register", {
      data: {
        email: revokedEmail,
        password,
        name: "Revoked User",
        invite: new URL(revoked.url).searchParams.get("invite"),
      },
    });
    expect(denied.ok()).toBeFalsy();
  } finally {
    await Promise.all(contexts.map((c) => c.dispose()));
    await db.$disconnect();
  }
});
