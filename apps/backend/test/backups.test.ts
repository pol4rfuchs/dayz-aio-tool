import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-backups-db-"));
process.env.DATA_DIR = dataDir;
process.env.DAYZ_AIO_AUTH_DISABLED = "true";

const { closeDatabase, getDb, initDatabase } = await import("../src/db/database.js");
const { createBackup, listBackups } = await import("../src/modules/backups/service.js");
const { writeTextFileWithBackup } = await import("../src/modules/files/safeWrite.js");

function insertServer(id: string, rootPath: string) {
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO servers (id, name, root_path, profile_path, executable_path, mission_path, launch_params, workshop_app_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, id, rootPath, path.join(rootPath, "profiles"), path.join(rootPath, "DayZServer_x64.exe"), "", "", "221100", now, now);
}

test.after(async () => {
  closeDatabase();
  await fs.rm(dataDir, { recursive: true, force: true });
});

test("createBackup without any existing file fails with 404 and leaves no empty backup folder", async (t) => {
  initDatabase();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-backups-root-"));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });
  insertServer("bk-empty", root);

  await assert.rejects(
    createBackup({ serverId: "bk-empty", type: "test", reason: "nothing to copy", files: [path.join(root, "missing.xml")] }),
    (error: Error & { statusCode?: number }) => error.statusCode === 404
  );
  const serverBackupDir = path.join(dataDir, "backups", "bk-empty");
  const leftovers = await fs.readdir(serverBackupDir).catch(() => [] as string[]);
  assert.deepEqual(leftovers, []);
  assert.equal(listBackups("bk-empty").length, 0);
});

test("writeTextFileWithBackup can create a new file and only backs up existing ones", async (t) => {
  initDatabase();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-backups-root-"));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });
  insertServer("bk-new", root);
  const target = path.join(root, "db", "messages.xml");

  await writeTextFileWithBackup({ serverId: "bk-new", filePath: target, backupType: "economy", reason: "create", content: "<messages/>" });
  assert.equal(await fs.readFile(target, "utf8"), "<messages/>");
  assert.equal(listBackups("bk-new").length, 0);

  await writeTextFileWithBackup({ serverId: "bk-new", filePath: target, backupType: "economy", reason: "update", content: "<messages>2</messages>" });
  assert.equal(await fs.readFile(target, "utf8"), "<messages>2</messages>");
  assert.equal(listBackups("bk-new").length, 1);
});
