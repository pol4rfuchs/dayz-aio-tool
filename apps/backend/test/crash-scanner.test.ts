import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { walkCrashFiles } from "../src/modules/crash/routes.js";

test("crash scanner finds local RPT files and skips symlink escapes", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-crash-"));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-outside-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });
  await fs.writeFile(path.join(root, "server-crash.RPT"), "fatal crash", "utf8");
  await fs.writeFile(path.join(outside, "outside-crash.RPT"), "must not leak", "utf8");
  try {
    await fs.symlink(outside, path.join(root, "escape"), "dir");
  } catch {
    // Windows without symlink privileges: the main scanner behavior is still testable.
  }
  const files = await walkCrashFiles(root);
  assert.equal(files.some((file) => file.path.includes("server-crash.RPT")), true);
  assert.equal(files.some((file) => file.path.includes("outside-crash.RPT")), false);
});
