import assert from "node:assert/strict";
import test from "node:test";
import { redactUrlSecrets } from "../src/shared/logging.js";

test("redactUrlSecrets masks the apiKey query parameter used by the WebSocket handshake", () => {
  assert.equal(redactUrlSecrets("/ws?apiKey=super-secret-key"), "/ws?apiKey=***");
  assert.equal(redactUrlSecrets("/ws?foo=1&apiKey=abc123&bar=2"), "/ws?foo=1&apiKey=***&bar=2");
  assert.equal(redactUrlSecrets("/api/servers"), "/api/servers");
});
