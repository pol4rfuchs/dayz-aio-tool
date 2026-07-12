import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Fastify from "fastify";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-logs-db-"));
process.env.DATA_DIR = dataDir;
process.env.DAYZ_AIO_AUTH_DISABLED = "true";

const { closeDatabase, getDb, initDatabase } = await import("../src/db/database.js");
const { logRoutes } = await import("../src/modules/logs/routes.js");

function insertServer(input: { id: string; rootPath: string; profilePath: string; missionPath: string }) {
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
    input.profilePath,
    path.join(input.rootPath, "DayZServer_x64.exe"),
    input.missionPath,
    "-config=serverDZ.cfg",
    "221100",
    now,
    now
  );
}

async function buildLogTestApp() {
  const app = Fastify({ logger: false });
  await app.register(logRoutes);
  return app;
}

test.after(async () => {
  closeDatabase();
  await fs.rm(dataDir, { recursive: true, force: true });
});

test("live logs lists recent RPT/ADM/log files and skips noisy folders", async (t) => {
  initDatabase();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-logs-root-"));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });

  const profilePath = path.join(root, "profiles");
  const missionPath = path.join(root, "mpmissions", "dayzOffline.chernarusplus");
  await fs.mkdir(profilePath, { recursive: true });
  await fs.mkdir(path.join(root, "node_modules"), { recursive: true });
  await fs.writeFile(path.join(profilePath, "server_2026.RPT"), "RPT line", "utf8");
  await fs.writeFile(path.join(profilePath, "admin.ADM"), "ADM line", "utf8");
  await fs.writeFile(path.join(root, "node_modules", "ignored.log"), "skip", "utf8");
  insertServer({ id: "logs-list", rootPath: root, profilePath, missionPath });

  const app = await buildLogTestApp();
  t.after(async () => { await app.close(); });

  const response = await app.inject({ method: "GET", url: "/api/servers/logs-list/live-logs" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  const names = body.files.map((file: { name: string }) => file.name);
  assert.equal(names.includes("server_2026.RPT"), true);
  assert.equal(names.includes("admin.ADM"), true);
  assert.equal(names.includes("ignored.log"), false);
  assert.equal(Array.isArray(body.runtime), true);
});

test("live log file tail reads only files inside the server root", async (t) => {
  initDatabase();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-logs-root-"));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-logs-outside-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });

  const profilePath = path.join(root, "profiles");
  const missionPath = path.join(root, "mpmissions", "dayzOffline.enoch");
  await fs.mkdir(profilePath, { recursive: true });
  const logFile = path.join(profilePath, "script.log");
  await fs.writeFile(logFile, "one\ntwo\nthree", "utf8");
  const outsideFile = path.join(outside, "outside.log");
  await fs.writeFile(outsideFile, "nope", "utf8");
  insertServer({ id: "logs-tail", rootPath: root, profilePath, missionPath });

  const app = await buildLogTestApp();
  t.after(async () => { await app.close(); });

  const ok = await app.inject({ method: "GET", url: `/api/servers/logs-tail/live-logs/file?path=${encodeURIComponent(logFile)}&bytes=1000` });
  assert.equal(ok.statusCode, 200);
  assert.match(ok.json().tail, /three/);

  const blocked = await app.inject({ method: "GET", url: `/api/servers/logs-tail/live-logs/file?path=${encodeURIComponent(outsideFile)}&bytes=1000` });
  assert.equal(blocked.statusCode, 400);
  assert.match(blocked.json().error, /Blocked unsafe path outside root/);
});
