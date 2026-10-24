import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertInsideRoot } from "../src/shared/pathGuard.js";

test("assertInsideRoot accepts children and names that merely start with two dots", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-guard-"));
  assert.doesNotThrow(() => assertInsideRoot(root, path.join(root, "a", "b.txt")));
  assert.doesNotThrow(() => assertInsideRoot(root, path.join(root, "..foo", "x")));
  assert.throws(() => assertInsideRoot(root, path.join(root, "..", "x")), /outside root/);
});

test("assertInsideRoot blocks symlinks that point outside the root", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-guard-root-"));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-guard-out-"));
  try { await fs.symlink(outside, path.join(root, "link"), "junction"); }
  catch { t.skip("symlinks not available"); return; }
  assert.throws(() => assertInsideRoot(root, path.join(root, "link", "new.txt")), /outside root/);
});
