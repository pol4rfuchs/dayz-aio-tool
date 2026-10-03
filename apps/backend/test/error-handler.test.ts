import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { z } from "zod";
import { registerErrorHandler, sendError } from "../src/shared/errors.js";

async function buildApp() {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  const schema = z.object({ name: z.string().min(1), count: z.number().int() });
  // Deliberately no try/catch: the global handler must translate the ZodError.
  app.post("/unguarded", async (request) => schema.parse(request.body));
  app.post("/guarded", async (request, reply) => {
    try { return schema.parse(request.body); } catch (error) { return sendError(reply, error); }
  });
  app.get("/not-found", async () => { throw Object.assign(new Error("Server not found"), { statusCode: 404 }); });
  app.get("/boom", async () => { throw new Error("kaboom"); });
  return app;
}

test("ZodError from an unguarded handler becomes HTTP 400 with readable message", async () => {
  const app = await buildApp();
  const res = await app.inject({ method: "POST", url: "/unguarded", payload: { name: "", count: "x" } });
  assert.equal(res.statusCode, 400);
  const body = res.json();
  assert.match(body.error, /^Invalid request: /);
  assert.match(body.error, /name/);
  assert.ok(Array.isArray(body.details));
  await app.close();
});

test("sendError maps ZodError to 400 as well", async () => {
  const app = await buildApp();
  const res = await app.inject({ method: "POST", url: "/guarded", payload: {} });
  assert.equal(res.statusCode, 400);
  await app.close();
});

test("errors with statusCode keep it, others stay 500, shape is { error }", async () => {
  const app = await buildApp();
  const notFound = await app.inject({ method: "GET", url: "/not-found" });
  assert.equal(notFound.statusCode, 404);
  assert.deepEqual(notFound.json(), { error: "Server not found" });
  const boom = await app.inject({ method: "GET", url: "/boom" });
  assert.equal(boom.statusCode, 500);
  assert.deepEqual(boom.json(), { error: "kaboom" });
  await app.close();
});
