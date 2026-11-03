import { test } from "node:test";
import assert from "node:assert/strict";
import { lineTotal, lineInput, money, qty } from "../src/lib/domain";
import {
  passwordHash,
  passwordCheck,
  authorize,
  AppError,
} from "../src/lib/security";
test("Decimal pricing: fractional money, discount and VAT round once per line", () => {
  assert.equal(
    lineTotal({
      productId: "p",
      quantity: "3",
      price: "0.10",
      discount: 0,
      tax: 20,
    }).toFixed(2),
    "0.36",
  );
  assert.equal(
    lineTotal({
      productId: "p",
      quantity: "2.5",
      price: "99.99",
      discount: 10,
      tax: 20,
    }).toFixed(2),
    "269.97",
  );
});
test("reject negative, exponent, excessive precision and invalid percentage inputs", () => {
  for (const s of ["-1", "NaN", "1e6", "1.001"])
    assert.equal(money.safeParse(s).success, false);
  assert.equal(qty.safeParse("0").success, false);
  assert.equal(
    lineInput.safeParse({
      productId: "p",
      quantity: "1",
      price: "20",
      discount: 101,
      tax: 20,
    }).success,
    false,
  );
});
test("password hash uses unique salts and verifies without plaintext storage", async () => {
  const p = "long-test-password";
  const a = await passwordHash(p),
    b = await passwordHash(p);
  assert.notEqual(a, b);
  assert.ok(await passwordCheck(p, a));
  assert.equal(await passwordCheck("incorrect-password", a), false);
  assert.ok(!a.includes(p));
});
test("RBAC denies finance mutations to sales and all writes to viewers", () => {
  assert.throws(() => authorize({ role: "SALES" } as any, "finance"), AppError);
  assert.throws(
    () => authorize({ role: "VIEWER" } as any, "customers"),
    AppError,
  );
  assert.doesNotThrow(() => authorize({ role: "WAREHOUSE" } as any, "stock"));
});
