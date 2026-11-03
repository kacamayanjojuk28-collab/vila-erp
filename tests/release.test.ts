import { test } from "node:test";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { passwordCheck, passwordHash } from "../src/lib/security";
import { canRead } from "../src/lib/permissions";
import { loginAddress } from "../src/lib/login-limit";
test("Async scrypt reads historical N=16384 salt:hex hashes", async () => {
  const salt = "1234567890abcdef1234567890abcdef", password = "historical-password";
  const legacy = salt + ":" + scryptSync(password, salt, 64, {N:16384}).toString("hex");
  assert.equal(await passwordCheck(password, legacy), true);
  assert.equal(await passwordCheck("wrong-password", legacy), false);
  assert.match(await passwordHash(password), /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  for (const bad of ["", "invalid", salt + ":xx", salt + ":" + "00".repeat(63)])
    assert.equal(await passwordCheck(password, bad), false);
});
test("scrypt yields to the event loop during concurrent derivations", async () => {
  let ticked = false, settled = false;
  const pending = Promise.all(Array.from({length:8}, () => passwordHash("concurrent-password"))).then(result => { settled = true; return result; });
  await new Promise(resolve => setTimeout(() => {ticked = true; resolve(null);}, 0));
  assert.equal(ticked, true); assert.equal(settled, false); assert.equal((await pending).length, 8);
});
test("read matrix explicitly covers all roles and sensitive modules", () => {
  const expected: Record<string,string[]> = {OWNER:["finance","audit","sales","quotes","purchases","requests"], ADMIN:["finance","audit","sales","quotes","purchases","requests"], SALES:["sales","quotes"], WAREHOUSE:["purchases","requests"], FINANCE:["finance","sales","purchases"], MEMBER:[], VIEWER:[]};
  for(const [role, scopes] of Object.entries(expected))
    for(const scope of ["finance","audit","sales","quotes","purchases","requests"])
      assert.equal(canRead(role,scope),scopes.includes(scope),role+":"+scope);
  assert.equal(canRead("unknown","finance"),false);
});
test("forwarded IP requires a verified proxy token and a single valid address", () => {
  const previous=process.env.VILA_TRUSTED_PROXY_SECRET;
  process.env.VILA_TRUSTED_PROXY_SECRET="a".repeat(48);
  const req=(token:string,ip:string)=>new Request("http://localhost",{headers:{"x-vila-proxy-token":token,"x-forwarded-for":ip}});
  try {
    assert.equal(loginAddress(req("", "1.2.3.4")),"unverified");
    assert.equal(loginAddress(req("x".repeat(48), "1.2.3.4")),"unverified");
    assert.equal(loginAddress(req("a".repeat(48), "1.2.3.4")),"1.2.3.4");
    assert.equal(loginAddress(req("a".repeat(48), "1.2.3.4, 5.6.7.8")),"unverified");
    assert.equal(loginAddress(req("a".repeat(48), "invalid")),"unverified");
  } finally { if(previous===undefined)delete process.env.VILA_TRUSTED_PROXY_SECRET;else process.env.VILA_TRUSTED_PROXY_SECRET=previous; }
});
