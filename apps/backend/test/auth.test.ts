import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

const TEST_KEY = "test-api-key-that-is-long-enough-123456";

async function buildSecuredTestApp(options: { rateLimit?: number; authFailureLimit?: number } = {}) {
  process.env.DAYZ_AIO_API_KEY = TEST_KEY;
  process.env.DAYZ_AIO_SECRET_KEY = "test-secret-key-that-is-long-enough-for-tests-123456";
  process.env.DAYZ_AIO_AUTH_DISABLED = "false";
  process.env.DAYZ_AIO_RATE_LIMIT_PER_MINUTE = String(options.rateLimit ?? 1000);
  process.env.DAYZ_AIO_AUTH_FAILURE_LIMIT_PER_MINUTE = String(options.authFailureLimit ?? 1000);
  process.env.DAYZ_AIO_RATE_LIMIT_CLEANUP_INTERVAL_MS = "600000";
  process.env.DAYZ_AIO_RATE_LIMIT_BUCKET_TTL_MS = "600000";

  const { registerSecurityHooks, resetRateBucketsForTests, securityRoutes } = await import("../src/modules/security/auth.js");
  resetRateBucketsForTests();

  const app = Fastify({ logger: false });
  registerSecurityHooks(app);
  await app.register(securityRoutes);
  app.get("/health", async () => ({ ok: true }));
  app.get("/api/private", async () => ({ ok: true }));
  return app;
}

test("public health and auth status routes do not require an API key", async () => {
  const app = await buildSecuredTestApp();
  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    assert.equal(health.statusCode, 200);

    const status = await app.inject({ method: "GET", url: "/api/auth/status" });
    assert.equal(status.statusCode, 200);
    assert.equal(status.json().authRequired, true);
  } finally {
    await app.close();
  }
});

test("protected API routes reject missing or invalid API keys", async () => {
  const app = await buildSecuredTestApp();
  try {
    const missing = await app.inject({ method: "GET", url: "/api/private" });
    assert.equal(missing.statusCode, 401);

    const invalid = await app.inject({ method: "GET", url: "/api/private", headers: { "x-api-key": "wrong" } });
    assert.equal(invalid.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("protected API routes accept X-API-Key and Bearer tokens", async () => {
  const app = await buildSecuredTestApp();
  try {
    const header = await app.inject({ method: "GET", url: "/api/private", headers: { "x-api-key": TEST_KEY } });
    assert.equal(header.statusCode, 200);

    const bearer = await app.inject({ method: "GET", url: "/api/private", headers: { authorization: `Bearer ${TEST_KEY}` } });
    assert.equal(bearer.statusCode, 200);
  } finally {
    await app.close();
  }
});

test("rate limit returns 429 after the configured request budget", async () => {
  const app = await buildSecuredTestApp({ rateLimit: 2 });
  try {
    const headers = { "x-api-key": TEST_KEY };
    assert.equal((await app.inject({ method: "GET", url: "/api/private", headers })).statusCode, 200);
    assert.equal((await app.inject({ method: "GET", url: "/api/private", headers })).statusCode, 200);
    assert.equal((await app.inject({ method: "GET", url: "/api/private", headers })).statusCode, 429);
  } finally {
    await app.close();
  }
});

test("auth failure throttling returns 429 after repeated bad tokens", async () => {
  const app = await buildSecuredTestApp({ rateLimit: 100, authFailureLimit: 1 });
  try {
    assert.equal((await app.inject({ method: "GET", url: "/api/private", headers: { "x-api-key": "bad-1" } })).statusCode, 401);
    assert.equal((await app.inject({ method: "GET", url: "/api/private", headers: { "x-api-key": "bad-2" } })).statusCode, 429);
  } finally {
    await app.close();
  }
});
