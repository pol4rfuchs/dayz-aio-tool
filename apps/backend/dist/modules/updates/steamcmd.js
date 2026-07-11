import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { WORKSHOP_STEAMCMD_TIMEOUT_MS } from "../../shared/env.js";
export const DAYZ_DEDICATED_SERVER_APP_ID = "223350";
export const DAYZ_WORKSHOP_APP_ID = "221100";
export const DEFAULT_STEAMCMD_TIMEOUT_MS = 60 * 60_000;
let steamCmdChain = Promise.resolve();
let runningLabel;
let queued = 0;
let lastStartedAt;
let lastFinishedAt;
function redactCommand(file, args) {
    const redacted = args.map((arg, index) => {
        if (index > 0 && args[index - 1] === "+login" && arg !== "anonymous")
            return "<steam-user>";
        return arg;
    });
    return `${file} ${redacted.join(" ")}`;
}
export function getSteamCmdQueueState() {
    return { running: Boolean(runningLabel), runningLabel, queued, lastStartedAt, lastFinishedAt };
}
export function resetSteamCmdQueueForTests() {
    steamCmdChain = Promise.resolve();
    runningLabel = undefined;
    queued = 0;
    lastStartedAt = undefined;
    lastFinishedAt = undefined;
}
export function parseSteamCmdOutput(output) {
    const text = String(output || "");
    const findings = [];
    const add = (code, pattern) => { if (pattern.test(text))
        findings.push(code); };
    add("no_subscription", /No subscription/i);
    add("update_start_timeout", /Timed out waiting for update to start/i);
    add("access_denied", /Access Denied/i);
    add("no_connection", /No connection/i);
    add("disk_write_failure", /disk write failure|content file locked|file locked/i);
    add("steam_guard_required", /Steam Guard|Two-factor|2FA|steamguard|Steam Guard code/i);
    add("login_failed", /FAILED with result code|Invalid Password|Account Logon Denied|LogonFailure|login failure/i);
    const hardFailure = findings.some((f) => ["no_subscription", "update_start_timeout", "access_denied", "no_connection", "disk_write_failure", "steam_guard_required", "login_failed"].includes(f));
    return { findings, hardFailure, hasSuccess: /Success! App '\d+' fully installed/i.test(text) };
}
export function steamFailureReason(exitCode, analysis) {
    if (exitCode !== 0)
        return "steamcmd_exit_nonzero";
    if (analysis.findings.includes("no_subscription"))
        return "steamcmd_no_subscription";
    if (analysis.findings.includes("update_start_timeout"))
        return "steamcmd_update_start_timeout";
    if (analysis.findings.includes("access_denied"))
        return "steamcmd_access_denied";
    if (analysis.findings.includes("no_connection"))
        return "steamcmd_no_connection";
    if (analysis.findings.includes("disk_write_failure"))
        return "steamcmd_disk_write_failure";
    if (analysis.findings.includes("steam_guard_required"))
        return "steamcmd_steam_guard_required";
    if (analysis.findings.includes("login_failed"))
        return "steamcmd_login_failed";
    return undefined;
}
export async function runSteamCmd(file, args, options = {}) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_STEAMCMD_TIMEOUT_MS;
    const label = options.label ?? redactCommand(file, args);
    const queuedAt = new Date().toISOString();
    queued += 1;
    let release;
    const previous = steamCmdChain;
    steamCmdChain = previous.then(() => new Promise((resolve) => { release = resolve; }));
    await previous.catch(() => undefined);
    queued = Math.max(0, queued - 1);
    runningLabel = label;
    const startedAt = new Date().toISOString();
    lastStartedAt = startedAt;
    try {
        await fs.access(file);
        const result = await execa(file, args, { cwd: path.dirname(file), reject: false, all: true, timeout: timeoutMs });
        return {
            exitCode: result.exitCode ?? -1,
            output: result.all ?? "",
            queuedAt,
            startedAt,
            finishedAt: new Date().toISOString(),
            queueWaitMs: Date.parse(startedAt) - Date.parse(queuedAt),
            command: redactCommand(file, args)
        };
    }
    finally {
        lastFinishedAt = new Date().toISOString();
        runningLabel = undefined;
        release();
    }
}
export function workshopTimeoutMs() {
    return WORKSHOP_STEAMCMD_TIMEOUT_MS;
}
