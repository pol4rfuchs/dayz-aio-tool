import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret, isEncryptedSecret, maskSecret } from "../src/shared/secrets.js";

test("secrets are encrypted and decryptable", () => {
  const encrypted = encryptSecret("super-secret");
  assert.ok(encrypted);
  assert.equal(isEncryptedSecret(encrypted), true);
  assert.equal(decryptSecret(encrypted), "super-secret");
  assert.equal(maskSecret(encrypted), "***");
});
