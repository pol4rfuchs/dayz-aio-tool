import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Fastify from "fastify";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-persistence-db-"));
process.env.DATA_DIR = dataDir;
process.env.DAYZ_AIO_AUTH_DISABLED = "true";

const { closeDatabase, getDb, initDatabase } = await import("../src/db/database.js");
const { persistenceRoutes } = await import("../src/modules/persistence/routes.js");

function insertServer(input: { id: string; rootPath: string; missionPath: string }) {
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO servers (
      id, name, root_path, profile_path, executable_path, mission_path,
      launch_params, workshop_app_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.id,
    input.rootPath,
    path.join(input.rootPath, "profiles"),
    path.join(input.rootPath, "DayZServer_x64.exe"),
    input.missionPath,
    "-config=serverDZ.cfg",
    "221100",
    now,
    now
  );
}

async function buildPersistenceTestApp() {
  const app = Fastify({ logger: false });
  await app.register(persistenceRoutes);
  return app;
}

test.after(async () => {
  closeDatabase();
  await fs.rm(dataDir, { recursive: true, force: true });
});

test("persistence scan reports storage candidates and quarantine folders", async (t) => {
  initDatabase();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-persistence-root-"));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });

  const missionPath = path.join(root, "mpmissions", "dayzOffline.chernarusplus");
  await fs.mkdir(path.join(missionPath, "storage_1"), { recursive: true });
  await fs.writeFile(path.join(missionPath, "storage_1", "players.db"), "abc", "utf8");
  await fs.mkdir(path.join(missionPath, "storage_1_DISABLED_2026-07-12"), { recursive: true });
  insertServer({ id: "persist-scan", rootPath: root, missionPath });

  const app = await buildPersistenceTestApp();
  t.after(async () => { await app.close(); });

  const response = await app.inject({ method: "GET", url: "/api/servers/persist-scan/persistence/scan" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.ok, true);
  assert.equal(body.candidates.length, 1);
  assert.equal(body.candidates[0].name, "storage_1");
  assert.equal(body.candidates[0].files, 1);
  assert.equal(body.quarantines.length, 1);
  assert.equal(body.quarantines[0].name, "storage_1_DISABLED_2026-07-12");
});

test("persistence quarantine copies and disables active storage, then restore recreates active storage", async (t) => {
  initDatabase();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-persistence-root-"));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });

  const missionPath = path.join(root, "mpmissions", "dayzOffline.enoch");
  const storagePath = path.join(missionPath, "storage_1");
  await fs.mkdir(storagePath, { recursive: true });
  await fs.writeFile(path.join(storagePath, "players.db"), "persistent", "utf8");
  insertServer({ id: "persist-quarantine", rootPath: root, missionPath });

  const app = await buildPersistenceTestApp();
  t.after(async () => { await app.close(); });

  const quarantine = await app.inject({
    method: "POST",
    url: "/api/servers/persist-quarantine/persistence/quarantine",
    payload: { storageName: "storage_1" }
  });
  assert.equal(quarantine.statusCode, 200);
  const quarantineBody = quarantine.json();
  assert.equal(quarantineBody.ok, true);
  assert.equal((await fs.stat(quarantineBody.backupCopy)).isDirectory(), true);
  assert.equal((await fs.stat(quarantineBody.disabled)).isDirectory(), true);
  await assert.rejects(() => fs.stat(storagePath));

  const restore = await app.inject({
    method: "POST",
    url: "/api/servers/persist-quarantine/persistence/restore",
    payload: { quarantinePath: quarantineBody.disabled }
  });
  assert.equal(restore.statusCode, 200);
  const restoreBody = restore.json();
  assert.equal(restoreBody.ok, true);
  assert.equal(restoreBody.restored, storagePath);
  assert.equal(await fs.readFile(path.join(storagePath, "players.db"), "utf8"), "persistent");

  const auditCount = getDb().prepare("SELECT COUNT(*) as count FROM audit_log WHERE server_id = ? AND action IN ('persistence.quarantine', 'persistence.restore')").get("persist-quarantine") as { count: number };
  assert.equal(auditCount.count, 2);
});

test("persistence quarantine blocks while the server PID is alive", async (t) => {
  initDatabase();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-persistence-root-"));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });

  const missionPath = path.join(root, "mpmissions", "dayzOffline.chernarusplus");
  await fs.mkdir(path.join(missionPath, "storage_1"), { recursive: true });
  insertServer({ id: "persist-running", rootPath: root, missionPath });
  getDb().prepare("INSERT INTO server_state (server_id, status, pid, last_started_at, last_heartbeat_at) VALUES (?, ?, ?, ?, ?)")
    .run("persist-running", "running", process.pid, new Date().toISOString(), new Date().toISOString());

  const app = await buildPersistenceTestApp();
  t.after(async () => { await app.close(); });

  const response = await app.inject({
    method: "POST",
    url: "/api/servers/persist-running/persistence/quarantine",
    payload: { storageName: "storage_1" }
  });
  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /Stop the DayZ server/);
});
