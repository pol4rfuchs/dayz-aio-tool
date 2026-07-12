import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const { buildSteamAuthChecks, buildSteamCmdArgs, detectSteamCachedSession, redactSteamCmdArgs, redactSteamCmdOutput, redactSteamCmdOutputTail, resolveSteamLogin } = await import("../src/modules/updates/auth.js");

test("steam auth defaults to anonymous and never stores password material", () => {
  const auth = resolveSteamLogin({ steamLoginMode: "anonymous", steamUsername: "ignored" });
  assert.equal(auth.steamLoginMode, "anonymous");
  assert.equal(auth.username, "anonymous");
  assert.equal(auth.storesPassword, false);
  assert.deepEqual(buildSteamCmdArgs(auth, ["+quit"]), ["+login", "anonymous", "+quit"]);
});

test("steam auth uses username for cached user session mode and redacts command labels", () => {
  const auth = resolveSteamLogin({ steamLoginMode: "user", steamUsername: "lost.soldiers.eu" });
  const args = buildSteamCmdArgs(auth, ["+app_update", "223350", "+quit"]);
  assert.deepEqual(args, ["+login", "lost.soldiers.eu", "+app_update", "223350", "+quit"]);
  assert.deepEqual(redactSteamCmdArgs(args), ["+login", "<steam-user>", "+app_update", "223350", "+quit"]);
});

test("steam auth preflight detects cached SteamCMD loginusers config", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dayz-aio-steam-auth-"));
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });
  const steamcmd = path.join(root, "steamcmd.exe");
  await fs.writeFile(steamcmd, "fake", "utf8");
  await fs.mkdir(path.join(root, "config"), { recursive: true });
  await fs.writeFile(path.join(root, "config", "loginusers.vdf"), `"users"\n{\n  "1"\n  {\n    "AccountName" "lost.soldiers.eu"\n  }\n}\n`, "utf8");

  const session = await detectSteamCachedSession(steamcmd, "lost.soldiers.eu");
  assert.equal(session.likelyUsableForUser, true);

  const preflight = await buildSteamAuthChecks(steamcmd, resolveSteamLogin({ steamLoginMode: "user", steamUsername: "lost.soldiers.eu" }));
  const sessionCheck = preflight.checks.find((check: { name: string }) => check.name === "steam_user_session");
  assert.equal(sessionCheck?.status, "pass");
});


test("steam auth redacts password and Steam Guard code from command labels and output tails", () => {
  const auth = resolveSteamLogin({
    steamLoginMode: "user",
    steamUsername: "lost.soldiers.eu",
    steamPassword: "SuperSecretPassword123!",
    steamGuardCode: "ABCDE"
  });
  const args = buildSteamCmdArgs(auth, ["+app_update", "223350", "validate", "+quit"]);
  assert.deepEqual(redactSteamCmdArgs(args), ["+login", "<steam-user>", "<steam-secret>", "<steam-secret>", "+app_update", "223350", "validate", "+quit"]);

  const output = `SteamCMD command: +login lost.soldiers.eu SuperSecretPassword123! ABCDE +app_update 223350 validate +quit\nLogin failure for SuperSecretPassword123! with code ABCDE`;
  const redacted = redactSteamCmdOutput(output, auth);
  assert.equal(redacted.includes("SuperSecretPassword123!"), false);
  assert.equal(redacted.includes("ABCDE"), false);
  assert.equal(redacted.includes("+login <steam-user> <steam-secret> <steam-secret>"), true);

  const tail = redactSteamCmdOutputTail(output, auth, 2000);
  assert.equal(tail.includes("SuperSecretPassword123!"), false);
  assert.equal(tail.includes("ABCDE"), false);
});
