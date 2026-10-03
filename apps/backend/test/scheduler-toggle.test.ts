import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Fastify from "fastify";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-sched-db-"));
process.env.DATA_DIR = dataDir;
process.env.DAYZ_AIO_AUTH_DISABLED = "true";

const { closeDatabase, getDb, initDatabase } = await import("../src/db/database.js");
const { schedulerRoutes } = await import("../src/modules/scheduler/routes.js");
const { registerErrorHandler } = await import("../src/shared/errors.js");

test.after(async () => {
  closeDatabase();
  await fs.rm(dataDir, { recursive: true, force: true });
});

test("schedules can be disabled and re-enabled, and deleting a missing one is a 404", async () => {
  initDatabase();
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO servers (id, name, root_path, profile_path, executable_path, mission_path, launch_params, workshop_app_id, created_at, updated_at)
    VALUES ('s1', 's1', '/dz', '/dz/p', '/dz/x.exe', '', '', '221100', ?, ?)
  `).run(now, now);
  getDb().prepare(`
    INSERT INTO schedules (id, server_id, name, action, enabled, interval_minutes, next_run_at, created_at, updated_at)
    VALUES ('sch1', 's1', 'Nightly backup', 'backup', 1, 60, ?, ?, ?)
  `).run(now, now, now);

  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  await app.register(schedulerRoutes);

  const off = await app.inject({ method: "PATCH", url: "/api/schedules/sch1", payload: { enabled: false } });
  assert.equal(off.statusCode, 200);
  assert.equal(off.json().nextRunAt, null);
  assert.equal((getDb().prepare("SELECT enabled FROM schedules WHERE id='sch1'").get() as { enabled: number }).enabled, 0);

  const on = await app.inject({ method: "PATCH", url: "/api/schedules/sch1", payload: { enabled: true } });
  assert.equal(on.statusCode, 200);
  assert.ok(Date.parse(on.json().nextRunAt) > Date.now());

  assert.equal((await app.inject({ method: "PATCH", url: "/api/schedules/sch1", payload: { enabled: "yes" } })).statusCode, 400);
  assert.equal((await app.inject({ method: "PATCH", url: "/api/schedules/nope", payload: { enabled: true } })).statusCode, 404);
  assert.equal((await app.inject({ method: "DELETE", url: "/api/schedules/nope" })).statusCode, 404);
  assert.equal((await app.inject({ method: "DELETE", url: "/api/schedules/sch1" })).statusCode, 200);
  await app.close();
});
