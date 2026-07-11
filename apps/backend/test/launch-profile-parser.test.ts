import assert from "node:assert/strict";
import test from "node:test";
import { collectStrings } from "../src/modules/servers/launchProfile.js";

test("collectStrings extracts launch-relevant strings", () => {
  const values = collectStrings({ launch: { args: "-config=serverDZ.cfg -mod=1559212036;1564026768 -port=2302" } });
  assert.equal(values.some((value) => value.includes("-mod=1559212036")), true);
});

test("collectStrings is cycle-safe", () => {
  const root: any = { launchParams: "-profiles=profiles" };
  root.self = root;
  const values = collectStrings(root);
  assert.equal(values.includes("-profiles=profiles"), true);
});

test("collectStrings enforces recursion depth guard", () => {
  let node: any = { launchParams: "-config=serverDZ.cfg" };
  for (let index = 0; index < 50; index += 1) node = { nested: node };
  assert.doesNotThrow(() => collectStrings(node));
});
