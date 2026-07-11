import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { findDzsaCandidates, hasDzsaLauncherServer } from "../src/modules/servers/dzsaDetection.js";

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-dzsa-"));
  try { await fn(dir); } finally { await fs.rm(dir, { recursive: true, force: true }); }
}

test("findDzsaCandidates detects known DZSA executable names", async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(path.join(dir, "DZSALModServer.exe"), "");
    const found = await findDzsaCandidates(dir);
    assert.equal(found.length, 1);
    assert.equal(found[0].name, "DZSALModServer.exe");
    assert.equal(found[0].source, "known-name");
    assert.equal(await hasDzsaLauncherServer(dir), true);
  });
});

test("findDzsaCandidates detects fuzzy DZSA folders without duplicates", async () => {
  await withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, "my-dzsa-launcher-server"));
    const found = await findDzsaCandidates(dir);
    assert.equal(found.length, 1);
    assert.equal(found[0].type, "directory");
    assert.equal(found[0].source, "fuzzy-scan");
  });
});

test("hasDzsaLauncherServer returns false for missing package", async () => {
  await withTempDir(async (dir) => {
    assert.equal(await hasDzsaLauncherServer(dir), false);
  });
});
