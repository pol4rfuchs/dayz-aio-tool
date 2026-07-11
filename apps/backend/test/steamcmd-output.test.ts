import assert from "node:assert/strict";
import test from "node:test";
import { parseSteamCmdOutput, steamFailureReason } from "../src/modules/updates/steamcmd.js";

test("SteamCMD parser treats No subscription as entitlement failure even with zero exit", () => {
  const analysis = parseSteamCmdOutput("ERROR! Failed to install app '223350' (No subscription)\n");
  assert.equal(analysis.findings.includes("no_subscription"), true);
  assert.equal(analysis.hardFailure, true);
  assert.equal(steamFailureReason(0, analysis), "steamcmd_no_subscription");
});

test("SteamCMD parser treats timeout-before-success as failure", () => {
  const output = "Update state (0x0) : Timed out waiting for update to start, bailing.\nSuccess! App '223350' fully installed.";
  const analysis = parseSteamCmdOutput(output);
  assert.equal(analysis.hasSuccess, true);
  assert.equal(analysis.findings.includes("update_start_timeout"), true);
  assert.equal(steamFailureReason(0, analysis), "steamcmd_update_start_timeout");
});

test("SteamCMD parser classifies Workshop Access Denied", () => {
  const analysis = parseSteamCmdOutput("Failed to get manifest request code, 'Access Denied'");
  assert.equal(analysis.findings.includes("access_denied"), true);
  assert.equal(steamFailureReason(0, analysis), "steamcmd_access_denied");
});
