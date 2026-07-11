import assert from "node:assert/strict";
import test from "node:test";
import { crc32 } from "../src/shared/crc32.js";
import { createStoredZip } from "../src/modules/debug/zip.js";

test("crc32 matches the canonical test vector", () => {
  assert.equal(crc32(Buffer.from("123456789", "ascii")), 0xcbf43926);
});

test("ZIP writer rejects non-Zip64 entry count overflows explicitly", () => {
  const entries = Array.from({ length: 65536 }, (_, index) => ({ name: `entry-${index}.txt`, content: "x" }));
  assert.throws(() => createStoredZip(entries), /ZIP entry limit exceeded/);
});
