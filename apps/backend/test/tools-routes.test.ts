import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Fastify from "fastify";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-tools-db-"));
process.env.DATA_DIR = dataDir;
process.env.DAYZ_AIO_AUTH_DISABLED = "true";
delete process.env.STEAM_WEB_API_KEY;
delete process.env.DAYZ_AIO_STEAM_WEB_API_KEY;

const { closeDatabase, getDb, initDatabase } = await import("../src/db/database.js");
const { toolRoutes } = await import("../src/modules/tools/routes.js");

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

async function buildToolTestApp() {
  const app = Fastify({ logger: false });
  await app.register(toolRoutes);
  return app;
}

test.after(async () => {
  closeDatabase();
  await fs.rm(dataDir, { recursive: true, force: true });
});

test("day/night calculator returns copy-paste-ready serverDZ.cfg values", async (t) => {
  const app = await buildToolTestApp();
  t.after(async () => { await app.close(); });

  const response = await app.inject({
    method: "POST",
    url: "/api/tools/day-night/calculate",
    payload: { fullCycleMinutes: 180, nightSpeedMultiplier: 4, serverTimePersistent: false }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.serverTimeAcceleration, 8);
  assert.equal(body.serverNightTimeAcceleration, 4);
  assert.deepEqual(body.cfg, {
    serverTimeAcceleration: 8,
    serverNightTimeAcceleration: 4,
    serverTimePersistent: 0
  });
});

test("classname finder deduplicates types.xml and cfgspawnabletypes.xml results", async (t) => {
  initDatabase();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-tools-root-"));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });

  const missionPath = path.join(root, "mpmissions", "dayzOffline.chernarusplus");
  await fs.mkdir(path.join(missionPath, "db"), { recursive: true });
  await fs.writeFile(path.join(missionPath, "db", "types.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<types>
  <type name="Apple">
    <nominal>10</nominal><lifetime>3600</lifetime><restock>0</restock><min>5</min><quantmin>-1</quantmin><quantmax>-1</quantmax><cost>100</cost>
    <category name="food"/>
  </type>
  <type name="AppleGreen">
    <nominal>8</nominal><lifetime>3600</lifetime><restock>0</restock><min>2</min><quantmin>-1</quantmin><quantmax>-1</quantmax><cost>100</cost>
    <category name="food"/>
  </type>
</types>`, "utf8");
  await fs.writeFile(path.join(missionPath, "cfgspawnabletypes.xml"), `<spawnabletypes>
  <type name="Apple" />
  <type name="ExpansionQuestItem" />
</spawnabletypes>`, "utf8");
  insertServer({ id: "tools-classnames", rootPath: root, missionPath });

  const app = await buildToolTestApp();
  t.after(async () => { await app.close(); });

  const response = await app.inject({ method: "GET", url: "/api/servers/tools-classnames/economy/classnames?query=apple&limit=20" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.items.map((item: { classname: string }) => item.classname), ["Apple", "AppleGreen"]);
  assert.equal(body.items[0].source, "types.xml");
  assert.equal(body.items[0].nominal, 10);
});

test("classname finder rejects mission paths outside the server root", async (t) => {
  initDatabase();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-tools-root-"));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-tools-outside-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });
  insertServer({ id: "tools-escape", rootPath: root, missionPath: outside });

  const app = await buildToolTestApp();
  t.after(async () => { await app.close(); });

  const response = await app.inject({ method: "GET", url: "/api/servers/tools-escape/economy/classnames?query=" });
  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /Blocked unsafe path outside root/);
});

test("VAC/Steam ban check is disabled cleanly without a Steam Web API key", async (t) => {
  const app = await buildToolTestApp();
  t.after(async () => { await app.close(); });

  const response = await app.inject({
    method: "POST",
    url: "/api/tools/steam/ban-check",
    payload: { steamIds: ["76561198000000000"] }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.configured, false);
  assert.match(body.error, /STEAM_WEB_API_KEY/);
});
