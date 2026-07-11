import { execa, execaCommand } from "execa";
import fs from "node:fs/promises";
import path from "node:path";
import { getDb } from "../../db/database.js";
import { LOG_BUFFER_LIMIT } from "../../shared/env.js";
import { requireServer } from "../servers/repository.js";
import { writeAudit } from "../audit/service.js";
import { createBackup } from "../backups/service.js";
import { broadcast } from "../realtime/hub.js";
import { detectLaunchProfile } from "../servers/launchProfile.js";
const processes = new Map();
const externalLogs = new Map();
async function fileExists(filePath) {
    try {
        return (await fs.stat(filePath)).isFile();
    }
    catch {
        return false;
    }
}
async function dirExists(dirPath) {
    try {
        return (await fs.stat(dirPath)).isDirectory();
    }
    catch {
        return false;
    }
}
export async function preflightStartServer(serverId) {
    const server = requireServer(serverId);
    const launchProfile = await detectLaunchProfile({ rootPath: server.rootPath, profilePath: server.profilePath, launchParams: server.launchParams });
    const launchBlocking = launchProfile.expansionDetected && !launchProfile.hasModParam;
    const launchWarning = launchProfile.hasModFolders && !launchProfile.hasModParam;
    const checks = [
        { key: "rootPath", label: "Server root folder", ok: await dirExists(server.rootPath), path: server.rootPath, blocking: true },
        { key: "executablePath", label: "DayZServer_x64.exe", ok: await fileExists(server.executablePath), path: server.executablePath, blocking: true },
        { key: "serverDzCfg", label: "serverDZ.cfg", ok: await fileExists(path.join(server.rootPath, "serverDZ.cfg")), path: path.join(server.rootPath, "serverDZ.cfg"), blocking: true },
        { key: "profilePath", label: "Profile folder", ok: await dirExists(server.profilePath), path: server.profilePath, blocking: false },
        { key: "missionPath", label: "Mission folder", ok: Boolean(server.missionPath) && await dirExists(server.missionPath), path: server.missionPath, blocking: false },
        { key: "typesXml", label: "types.xml", ok: Boolean(server.missionPath) && await fileExists(path.join(server.missionPath, "db", "types.xml")), path: server.missionPath ? path.join(server.missionPath, "db", "types.xml") : "", blocking: false },
        { key: "launchParams", label: "Launch parameters", ok: Boolean(server.launchParams?.trim()), path: server.launchParams, blocking: false },
        { key: "launchProfile.mods", label: "Launch profile for modded server", ok: !(launchBlocking || launchWarning), path: server.launchParams, blocking: launchBlocking, message: launchBlocking ? "Expansion/modded profile detected but -mod= is missing. Import/paste the old launch params before Start." : launchWarning ? "@mod folders detected; no -mod= entry found. Check before Start." : "Launch profile looks compatible with detected mod folders." }
    ];
    const blockers = checks.filter((check) => check.blocking && !check.ok);
    return {
        ok: blockers.length === 0,
        serverId,
        blockingFailures: blockers.length,
        checks,
        recommendedAction: blockers.length ? "Fix blocking file/path or launch profile checks before starting this server." : "Start preflight passed.",
        launchProfile
    };
}
function pushLog(serverId, line) {
    const proc = processes.get(serverId);
    const target = proc?.logs ?? externalLogs.get(serverId) ?? [];
    target.push(line);
    target.splice(0, Math.max(0, target.length - LOG_BUFFER_LIMIT));
    if (!proc)
        externalLogs.set(serverId, target);
    broadcast("server.log", { line }, serverId);
}
function splitLaunchParams(params) {
    return params.trim().length ? params.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((arg) => arg.replace(/^"|"$/g, "")) ?? [] : [];
}
function isPidAlive(pid) {
    if (!pid)
        return false;
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
async function killPid(pid) {
    if (process.platform === "win32") {
        await execaCommand(`taskkill /PID ${pid} /T /F`, { reject: false });
    }
    else {
        try {
            process.kill(pid, "SIGTERM");
        }
        catch { /* already dead */ }
    }
}
export function getRuntimeStatus(serverId) {
    const proc = processes.get(serverId);
    const row = getDb().prepare(`
    SELECT server_id as serverId, status, pid, last_started_at as lastStartedAt, last_stopped_at as lastStoppedAt, last_heartbeat_at as lastHeartbeatAt
    FROM server_state WHERE server_id = ?
  `).get(serverId);
    const pid = proc?.child.pid ?? row?.pid ?? null;
    const pidAlive = proc ? true : isPidAlive(pid);
    const status = proc ? "running" : pidAlive ? "running-external" : row?.status === "running" ? "stale" : row?.status ?? "unknown";
    if (!proc && row?.status === "running" && !pidAlive) {
        const stoppedAt = new Date().toISOString();
        getDb().prepare(`UPDATE server_state SET status = 'stopped', pid = NULL, last_stopped_at = ?, last_heartbeat_at = ? WHERE server_id = ?`)
            .run(stoppedAt, stoppedAt, serverId);
    }
    return {
        serverId,
        ...(row ?? { status: "unknown" }),
        status,
        inMemoryRunning: Boolean(proc),
        pid,
        pidAlive,
        logLines: getLogs(serverId, 120).length
    };
}
export function getAllRuntimeStatuses() {
    const rows = getDb().prepare("SELECT server_id as serverId FROM server_state").all();
    return rows.map((row) => getRuntimeStatus(row.serverId));
}
export function getLogs(serverId, limit = 300) {
    const proc = processes.get(serverId);
    const logs = proc?.logs ?? externalLogs.get(serverId) ?? [];
    return logs.slice(-Math.min(Math.max(limit, 1), LOG_BUFFER_LIMIT));
}
export async function startServer(serverId) {
    const server = requireServer(serverId);
    if (processes.has(serverId)) {
        return { ok: true, serverId, status: "running", note: "Already running in this backend process." };
    }
    const current = getRuntimeStatus(serverId);
    if (current.pidAlive && current.status === "running-external") {
        return { ok: true, serverId, status: "running-external", pid: current.pid, note: "Process is alive but was started outside this backend runtime." };
    }
    const preflight = await preflightStartServer(serverId);
    if (!preflight.ok) {
        throw Object.assign(new Error(preflight.recommendedAction), { statusCode: 400, details: preflight });
    }
    const args = splitLaunchParams(server.launchParams);
    const child = execa(server.executablePath, args, {
        cwd: server.rootPath,
        detached: false,
        reject: false,
        all: true,
        windowsHide: false
    });
    const startedAt = new Date().toISOString();
    const record = { child, startedAt, logs: [] };
    processes.set(serverId, record);
    child.all?.on("data", (chunk) => {
        const text = String(chunk);
        for (const line of text.split(/\r?\n/).filter(Boolean))
            pushLog(serverId, line);
    });
    getDb().prepare(`
    UPDATE server_state
    SET status = 'running', pid = ?, last_started_at = ?, last_heartbeat_at = ?
    WHERE server_id = ?
  `).run(child.pid ?? null, startedAt, startedAt, serverId);
    writeAudit({ serverId, action: "server.start", target: server.executablePath, metadata: { args, pid: child.pid } });
    broadcast("server.status", getRuntimeStatus(serverId), serverId);
    child.finally(() => {
        const active = processes.get(serverId);
        if (active?.child !== child)
            return;
        processes.delete(serverId);
        const stoppedAt = new Date().toISOString();
        getDb().prepare(`
      UPDATE server_state
      SET status = 'stopped', pid = NULL, last_stopped_at = ?, last_heartbeat_at = ?
      WHERE server_id = ?
    `).run(stoppedAt, stoppedAt, serverId);
        writeAudit({ serverId, action: "server.exited", target: server.executablePath });
        broadcast("server.status", getRuntimeStatus(serverId), serverId);
    });
    return { ok: true, serverId, status: "running", pid: child.pid ?? null };
}
export async function stopServer(serverId) {
    requireServer(serverId);
    const proc = processes.get(serverId);
    const row = getRuntimeStatus(serverId);
    const stoppedAt = new Date().toISOString();
    if (proc) {
        proc.child.kill("SIGTERM", { forceKillAfterDelay: 15000 });
        processes.delete(serverId);
    }
    else if (row.pidAlive && typeof row.pid === "number") {
        await killPid(row.pid);
    }
    getDb().prepare(`
    UPDATE server_state
    SET status = 'stopped', pid = NULL, last_stopped_at = ?, last_heartbeat_at = ?
    WHERE server_id = ?
  `).run(stoppedAt, stoppedAt, serverId);
    writeAudit({ serverId, action: "server.stop", target: "process", metadata: { previousPid: row.pid } });
    broadcast("server.status", getRuntimeStatus(serverId), serverId);
    return { ok: true, serverId, status: "stopped" };
}
export async function restartServer(serverId) {
    const server = requireServer(serverId);
    const files = [
        `${server.rootPath}/serverDZ.cfg`,
        server.missionPath ? `${server.missionPath}/db/types.xml` : ""
    ].filter(Boolean);
    await createBackup({ serverId, type: "restart", reason: "pre-restart safety backup", files });
    await stopServer(serverId);
    return startServer(serverId);
}
function quoteCliArg(value) {
    if (!value)
        return '""';
    return /\s|"/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}
function parseConfiguredPort(launchParams) {
    const match = launchParams.match(/(?:^|\s)-?port(?:=|\s+)(\d{2,5})(?=\s|$)/i);
    const port = match ? Number(match[1]) : 2302;
    return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 2302;
}
async function getPortBinding(port) {
    try {
        const result = process.platform === "win32"
            ? await execa("cmd", ["/c", "netstat -ano"], { reject: false, timeout: 5000 })
            : await execa("sh", ["-lc", "ss -lntu 2>/dev/null || netstat -lntu 2>/dev/null"], { reject: false, timeout: 5000 });
        const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
        const needle = new RegExp(`[:.]${port}(?:\\s|$)`, "i");
        const lines = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => needle.test(line)).slice(0, 20);
        return {
            port,
            bound: lines.length > 0,
            checkedAt: new Date().toISOString(),
            lines,
            note: lines.length ? "Port appears in local socket table." : "Port was not found in local socket table. DayZ mainly uses UDP, so check after server-ready."
        };
    }
    catch (error) {
        return {
            port,
            bound: false,
            checkedAt: new Date().toISOString(),
            lines: [],
            note: `Port check failed: ${error.message}`
        };
    }
}
export async function getServerControlSummary(serverId) {
    const server = requireServer(serverId);
    const status = getRuntimeStatus(serverId);
    const configuredPort = parseConfiguredPort(server.launchParams ?? "");
    const launchCommand = `${quoteCliArg(server.executablePath)}${server.launchParams?.trim() ? ` ${server.launchParams.trim()}` : ""}`;
    const port = await getPortBinding(configuredPort);
    return {
        serverId,
        server: {
            id: server.id,
            name: server.name,
            rootPath: server.rootPath,
            profilePath: server.profilePath,
            executablePath: server.executablePath,
            missionPath: server.missionPath,
            launchParams: server.launchParams,
            steamcmdPath: server.steamcmdPath,
            workshopAppId: server.workshopAppId
        },
        status,
        configuredPort,
        port,
        launchCommand,
        generatedAt: new Date().toISOString()
    };
}
export function heartbeatAllServers() {
    const statuses = getAllRuntimeStatuses();
    const now = new Date().toISOString();
    for (const status of statuses) {
        getDb().prepare(`UPDATE server_state SET status = ?, pid = ?, last_heartbeat_at = ? WHERE server_id = ?`)
            .run(status.status === "stale" ? "stopped" : status.status, status.pidAlive ? status.pid : null, now, status.serverId);
        broadcast("server.status", status, status.serverId);
    }
    return statuses;
}
