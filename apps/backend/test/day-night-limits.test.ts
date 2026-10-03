import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

process.env.DAYZ_AIO_AUTH_DISABLED = "true";

const { toolRoutes } = await import("../src/modules/tools/routes.js");
const { registerErrorHandler } = await import("../src/shared/errors.js");

async function buildApp() {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  await app.register(toolRoutes);
  return app;
}

test("day/night calculator never produces a serverTimeAcceleration above DayZ's cap of 64", async () => {
  const app = await buildApp();
  const tooFast = await app.inject({ method: "POST", url: "/api/tools/day-night/calculate", payload: { fullCycleMinutes: 10 } });
  assert.equal(tooFast.statusCode, 400);

  const floor = await app.inject({ method: "POST", url: "/api/tools/day-night/calculate", payload: { fullCycleMinutes: 22.5 } });
  assert.equal(floor.statusCode, 200);
  assert.equal(floor.json().serverTimeAcceleration, 64);
  await app.close();
});
