import assert from "node:assert/strict";
import test from "node:test";
import { splitLaunchParams } from "../src/shared/launchParams.js";

test("splitLaunchParams handles fully quoted tokens", () => {
  assert.deepEqual(
    splitLaunchParams('"-config=C:/a b/serverDZ.cfg" -port=2302 "-profiles=C:/x y"'),
    ["-config=C:/a b/serverDZ.cfg", "-port=2302", "-profiles=C:/x y"]
  );
});

test("splitLaunchParams removes quotes around the value of -mod=\"...\"", () => {
  assert.deepEqual(splitLaunchParams('-mod="@A;@B" -freezecheck'), ["-mod=@A;@B", "-freezecheck"]);
});

test("splitLaunchParams handles empty input and extra whitespace", () => {
  assert.deepEqual(splitLaunchParams("   "), []);
  assert.deepEqual(splitLaunchParams("  -a   -b  "), ["-a", "-b"]);
});
