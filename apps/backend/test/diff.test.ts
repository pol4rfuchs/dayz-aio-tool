import assert from "node:assert/strict";
import test from "node:test";
import { lineDiff } from "../src/modules/diff/service.js";

test("lineDiff detects additions and removals", () => {
  const diff = lineDiff("a\nb\nc", "a\nb2\nc\nd");
  assert.equal(diff.some((line) => line.type === "remove" && line.line === "b"), true);
  assert.equal(diff.some((line) => line.type === "add" && line.line === "b2"), true);
  assert.equal(diff.some((line) => line.type === "add" && line.line === "d"), true);
});

test("lineDiff uses bounded fallback for large inputs", () => {
  const oldText = Array.from({ length: 1200 }, (_, i) => `old-${i}`).join("\n");
  const newText = Array.from({ length: 1200 }, (_, i) => i === 600 ? "changed" : `old-${i}`).join("\n");
  const diff = lineDiff(oldText, newText);
  assert.ok(diff.length >= 1200);
  assert.equal(diff.some((line) => line.type === "add" && line.line === "changed"), true);
});
