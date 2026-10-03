import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Fastify from "fastify";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-patch-db-"));
process.env.DATA_DIR = dataDir;
process.env.DAYZ_AIO_AUTH_DISABLED = "true";

const { closeDatabase, getDb, initDatabase } = await import("../src/db/database.js");
const { serverRoutes } = await import("../src/modules/servers/routes.js");
const { registerErrorHandler } = await import("../src/shared/errors.js");

function insertServer(id: string) {
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO servers (id, name, root_path, profile_path, executable_path, mission_path, launch_params, workshop_app_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, "Original", "C:/dz", "C:/dz/profiles", "C:/dz/DayZServer_x64.exe", "C:/dz/mpmissions/x", "-config=serverDZ.cfg -mod=@A;@B", "999", now, now);
  getDb().prepare("INSERT INTO server_state (server_id, status) VALUES (?, 'stopped')").run(id);
}

async function buildApp() {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  await app.register(serverRoutes, { prefix: "/api/servers" });
  return app;
}

test("PATCH with only a name keeps launch params, profile path and workshop app id", async () => {
  initDatabase();
  insertServer("srv-1");
  const app = await buildApp();
  const res = await app.inject({ method: "PATCH", url: "/api/servers/srv-1", payload: { name: "Renamed" } });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.name, "Renamed");
  assert.equal(body.launchParams, "-config=serverDZ.cfg -mod=@A;@B");
  assert.equal(body.profilePath, "C:/dz/profiles");
  assert.equal(body.workshopAppId, "999");
  await app.close();
});

test("PATCH with an invalid body is a 400, not a 500", async () => {
  const app = await buildApp();
  const res = await app.inject({ method: "PATCH", url: "/api/servers/srv-1", payload: { rconPort: "abc" } });
  assert.equal(res.statusCode, 400);
  await app.close();
  closeDatabase();
});
