import assert from "node:assert/strict";
import test from "node:test";
import { maskSecrets } from "../src/modules/debug/masking.js";

test("maskSecrets masks Steam Web API keys explicitly", () => {
  const masked = maskSecrets("STEAM_WEB_API_KEY=0123456789abcdef\nDAYZ_AIO_STEAM_WEB_API_KEY=abcdef0123456789");
  assert.equal(masked.includes("0123456789abcdef"), false);
  assert.equal(masked.includes("abcdef0123456789"), false);
  assert.equal(masked.includes("STEAM_WEB_API_KEY=***MASKED***"), true);
  assert.equal(masked.includes("DAYZ_AIO_STEAM_WEB_API_KEY=***MASKED***"), true);
});
