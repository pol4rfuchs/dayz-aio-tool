import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Fastify from "fastify";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-wipe-db-"));
process.env.DATA_DIR = dataDir;
process.env.DAYZ_AIO_AUTH_DISABLED = "true";

const { closeDatabase, getDb, initDatabase } = await import("../src/db/database.js");
const { wipeRoutes } = await import("../src/modules/wipe/routes.js");

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

async function buildWipeTestApp() {
  const app = Fastify({ logger: false });
  await app.register(wipeRoutes);
  return app;
}

test.after(async () => {
  closeDatabase();
  await fs.rm(dataDir, { recursive: true, force: true });
});

test("wipe plan reports storage folders and the required confirmation token", async (t) => {
  initDatabase();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-wipe-root-"));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });

  const missionPath = path.join(root, "mpmissions", "dayzOffline.chernarusplus");
  await fs.mkdir(path.join(missionPath, "storage_1"), { recursive: true });
  insertServer({ id: "wipe-plan", rootPath: root, missionPath });

  const app = await buildWipeTestApp();
  t.after(async () => { await app.close(); });

  const response = await app.inject({ method: "GET", url: "/api/servers/wipe-plan/wipe/plan" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.ok, true);
  assert.equal(body.confirmToken, "WIPE_STORAGE");
  assert.equal(body.storages.length, 1);
  assert.equal(body.storages[0].name, "storage_1");
  assert.equal(body.running, false);
});

test("wipe execute archives storage by rename and records the cycle and audit row", async (t) => {
  initDatabase();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-wipe-root-"));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });

  const missionPath = path.join(root, "mpmissions", "dayzOffline.enoch");
  const storagePath = path.join(missionPath, "storage_1");
  await fs.mkdir(storagePath, { recursive: true });
  await fs.writeFile(path.join(storagePath, "players.db"), "test", "utf8");
  insertServer({ id: "wipe-execute", rootPath: root, missionPath });

  const app = await buildWipeTestApp();
  t.after(async () => { await app.close(); });

  const response = await app.inject({
    method: "POST",
    url: "/api/servers/wipe-execute/wipe/execute",
    payload: { storageName: "storage_1", seasonName: "Season 2", confirm: "WIPE_STORAGE" }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.ok, true);
  assert.equal(body.archived.includes("storage_1_WIPE_"), true);
  await assert.rejects(() => fs.stat(storagePath));
  assert.equal((await fs.stat(body.archived)).isDirectory(), true);
  assert.equal((await fs.stat(path.join(body.archived, "players.db"))).isFile(), true);

  const cycle = getDb().prepare("SELECT name, storage_name as storageName, archived_path as archivedPath FROM wipe_cycles WHERE server_id = ?").get("wipe-execute") as { name: string; storageName: string; archivedPath: string };
  assert.equal(cycle.name, "Season 2");
  assert.equal(cycle.storageName, "storage_1");
  assert.equal(cycle.archivedPath, body.archived);

  const audit = getDb().prepare("SELECT action, target FROM audit_log WHERE server_id = ?").get("wipe-execute") as { action: string; target: string };
  assert.equal(audit.action, "wipe.execute");
  assert.equal(audit.target, "storage_1");
});

test("wipe execute blocks while the server PID is alive", async (t) => {
  initDatabase();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-wipe-root-"));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });

  const missionPath = path.join(root, "mpmissions", "dayzOffline.chernarusplus");
  await fs.mkdir(path.join(missionPath, "storage_1"), { recursive: true });
  insertServer({ id: "wipe-running", rootPath: root, missionPath });
  getDb().prepare("INSERT INTO server_state (server_id, status, pid, last_started_at, last_heartbeat_at) VALUES (?, ?, ?, ?, ?)")
    .run("wipe-running", "running", process.pid, new Date().toISOString(), new Date().toISOString());

  const app = await buildWipeTestApp();
  t.after(async () => { await app.close(); });

  const response = await app.inject({
    method: "POST",
    url: "/api/servers/wipe-running/wipe/execute",
    payload: { storageName: "storage_1", seasonName: "Blocked", confirm: "WIPE_STORAGE" }
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /Stop the DayZ server/);
  assert.equal((await fs.stat(path.join(missionPath, "storage_1"))).isDirectory(), true);
});
