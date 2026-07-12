import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const { getServerExeSnapshot, readAppManifestSummary, serverExeChanged } = await import("../src/modules/updates/verification.js");

test("update verification snapshots detect changed server executable metadata", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-update-verify-"));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });

  const exe = path.join(root, "DayZServer_x64.exe");
  await fs.writeFile(exe, "old", "utf8");
  const before = await getServerExeSnapshot({ rootPath: root, executablePath: exe });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await fs.writeFile(exe, "new-content", "utf8");
  const after = await getServerExeSnapshot({ rootPath: root, executablePath: exe });

  assert.equal(before.exists, true);
  assert.equal(after.exists, true);
  assert.equal(serverExeChanged(before, after), true);
});

test("update verification parses DayZ dedicated server appmanifest fields", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-update-manifest-"));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });

  await fs.mkdir(path.join(root, "steamapps"), { recursive: true });
  await fs.writeFile(path.join(root, "steamapps", "appmanifest_223350.acf"), `"AppState"
{
  "appid" "223350"
  "Universe" "1"
  "StateFlags" "4"
  "installdir" "DayZServer"
  "LastUpdated" "1780000000"
  "buildid" "22678180"
}`, "utf8");

  const manifest = await readAppManifestSummary({ rootPath: root });
  assert.equal(manifest.exists, true);
  assert.equal(manifest.stateFlags, "4");
  assert.equal(manifest.installDir, "DayZServer");
  assert.equal(manifest.lastUpdated, "1780000000");
  assert.equal(manifest.buildId, "22678180");
});
