import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getSteamCmdQueueState, runSteamCmd as runSteamCmdSerialized } from "./steamcmd.js";
import { z } from "zod";
import { requireServer } from "../servers/repository.js";
import { getRuntimeStatus } from "../process/service.js";
import { sendError } from "../../shared/errors.js";
import { writeAudit } from "../audit/service.js";
import { broadcast } from "../realtime/hub.js";
import { getDb } from "../../db/database.js";

const DAYZ_DEDICATED_SERVER_APP_ID = "223350";
const DAYZ_WORKSHOP_APP_ID = "221100";
const UPDATE_TIMEOUT_MS = 60 * 60_000;

const updateAuthSchema = z.object({
  steamUsername: z.string().trim().optional().default(""),
  useSteamLogin: z.boolean().optional()
}).optional();

type SteamAuthInput = { steamUsername?: string; useSteamLogin?: boolean };

function resolveSteamLogin(input?: SteamAuthInput) {
  const user = String(input?.steamUsername || process.env.DAYZ_AIO_STEAM_USERNAME || "").trim();
  const useLogin = Boolean(input?.useSteamLogin) || Boolean(user);
  return { username: useLogin && user ? user : "anonymous", mode: useLogin && user ? "steam-user" : "anonymous" };
}

function buildSteamCmdArgs(auth: { username: string }, tail: string[]) {
  return ["+login", auth.username, ...tail];
}

function redactSteamCmdArgs(args: string[]) {
  return args.map((arg, idx) => idx > 0 && args[idx - 1] === "+login" && arg !== "anonymous" ? "<steam-user>" : arg);
}

function parseSteamCmdOutput(output: string) {
  const text = String(output || "");
  const findings: string[] = [];
  const add = (code: string, pattern: RegExp) => { if (pattern.test(text)) findings.push(code); };
  add("no_subscription", /No subscription/i);
  add("update_start_timeout", /Timed out waiting for update to start/i);
  add("access_denied", /Access Denied/i);
  add("no_connection", /No connection/i);
  add("disk_write_failure", /disk write failure|content file locked|file locked/i);
  add("steam_guard_required", /Steam Guard|Two-factor|2FA|steamguard/i);
  add("login_failed", /FAILED with result code|Invalid Password|Account Logon Denied|LogonFailure|login failure/i);
  const hardFailure = findings.some((f) => ["no_subscription", "update_start_timeout", "access_denied", "no_connection", "disk_write_failure", "steam_guard_required", "login_failed"].includes(f));
  return { findings, hardFailure, hasSuccess: /Success! App '\d+' fully installed/i.test(text) };
}

function steamFailureReason(exitCode: number, analysis: ReturnType<typeof parseSteamCmdOutput>) {
  if (exitCode !== 0) return "steamcmd_exit_nonzero";
  if (analysis.findings.includes("no_subscription")) return "steamcmd_no_subscription";
  if (analysis.findings.includes("update_start_timeout")) return "steamcmd_update_start_timeout";
  if (analysis.findings.includes("access_denied")) return "steamcmd_access_denied";
  if (analysis.findings.includes("no_connection")) return "steamcmd_no_connection";
  if (analysis.findings.includes("disk_write_failure")) return "steamcmd_disk_write_failure";
  if (analysis.findings.includes("steam_guard_required")) return "steamcmd_steam_guard_required";
  if (analysis.findings.includes("login_failed")) return "steamcmd_login_failed";
  return undefined;
}

type UpdateJob = {
  id: string;
  serverId: string;
  action: "server-update" | "mods-update";
  status: "queued" | "running" | "completed" | "failed";
  total: number;
  completed: number;
  failed: number;
  current?: string;
  results: Array<{ target: string; exitCode: number; outputTail: string; copied?: boolean; verification?: any; steam?: any }>;
  error?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
};


type ServerExeSnapshot = {
  exists: boolean;
  path: string;
  size?: number;
  mtimeMs?: number;
  lastWriteTime?: string;
  fileVersion?: string;
  productVersion?: string;
};

async function getServerExeSnapshot(server: any): Promise<ServerExeSnapshot> {
  const exePath = server.executablePath || path.join(server.rootPath, "DayZServer_x64.exe");
  try {
    const stat = await fs.stat(exePath);
    const version = await readWindowsExeVersion(exePath);
    return {
      exists: true,
      path: exePath,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      lastWriteTime: stat.mtime.toISOString(),
      fileVersion: version.fileVersion,
      productVersion: version.productVersion
    };
  } catch {
    return { exists: false, path: exePath };
  }
}

async function readWindowsExeVersion(exePath: string) {
  if (process.platform !== "win32") return {};
  const ps = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `$v=(Get-Item -LiteralPath ${JSON.stringify(exePath)}).VersionInfo; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); Write-Output ($v.FileVersion + '|'+ $v.ProductVersion)`
  ];
  try {
    const result = await execa("powershell.exe", ps, { reject: false, all: true, timeout: 15_000 });
    const line = String(result.all || "").trim().split(/\r?\n/).pop() || "";
    const [fileVersion, productVersion] = line.split("|");
    return { fileVersion: fileVersion || undefined, productVersion: productVersion || undefined };
  } catch {
    return {};
  }
}

function serverExeChanged(before: ServerExeSnapshot, after: ServerExeSnapshot) {
  if (!before.exists || !after.exists) return false;
  return before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.fileVersion !== after.fileVersion || before.productVersion !== after.productVersion;
}

async function readAppManifestSummary(server: any) {
  const manifest = path.join(server.rootPath, "steamapps", `appmanifest_${DAYZ_DEDICATED_SERVER_APP_ID}.acf`);
  try {
    const text = await fs.readFile(manifest, "utf8");
    const pick = (key: string) => text.match(new RegExp(`"${key}"\\s+"([^\"]+)"`))?.[1];
    return {
      path: manifest,
      exists: true,
      stateFlags: pick("StateFlags"),
      installDir: pick("installdir"),
      lastUpdated: pick("LastUpdated"),
      buildId: pick("buildid")
    };
  } catch {
    return { path: manifest, exists: false };
  }
}

const jobs = new Map<string, UpdateJob>();
let updateChain: Promise<void> = Promise.resolve();

function updateJob(job: UpdateJob, patch: Partial<UpdateJob>) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  jobs.set(job.id, job);
  broadcast("updates.job.updated", job, job.serverId);
}

function rememberJob(job: UpdateJob) {
  jobs.set(job.id, job);
  const all = [...jobs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  while (all.length > 50) {
    const index = all.findIndex((candidate) => candidate.status !== "running");
    if (index < 0) break;
    const [old] = all.splice(index, 1);
    if (old) jobs.delete(old.id);
  }
}

function enqueueUpdateJob(job: UpdateJob, runner: () => Promise<void>) {
  rememberJob(job);
  updateChain = updateChain.then(async () => {
    updateJob(job, { status: "running" });
    try {
      await runner();
      updateJob(job, { status: job.failed > 0 ? "failed" : "completed", finishedAt: new Date().toISOString() });
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      updateJob(job, { status: "failed", error: message, finishedAt: new Date().toISOString() });
      writeAudit({ serverId: job.serverId, action: "updates.job.failed", target: job.action, metadata: { jobId: job.id, error: message } });
    }
  });
  return job;
}

async function exists(file: string) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function isRunning(serverId: string) {
  const runtime = getRuntimeStatus(serverId);
  return runtime.status === "running" || runtime.status === "running-external" || runtime.pidAlive === true;
}

function resolveSteamCmdPath(server: any) {
  if (server.steamcmdPath && String(server.steamcmdPath).trim()) return String(server.steamcmdPath).trim();
  return path.join(path.dirname(server.rootPath), "SteamCMD", "steamcmd.exe");
}

function workshopStagingRoot(server: any) {
  return path.join(path.dirname(server.rootPath), "Workshop");
}

function parseLaunchParamValues(params: string, name: "mod" | "serverMod") {
  const tokens = params.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((arg) => arg.replace(/^"|"$/g, "")) ?? [];
  const out: string[] = [];
  for (const token of tokens) {
    const match = token.match(new RegExp(`^-?${name}=?(.*)$`, "i"));
    if (!match) continue;
    const value = (match[1] ?? "").replace(/^"|"$/g, "").trim();
    if (!value) continue;
    for (const item of value.split(";")) {
      const clean = item.trim().replace(/^@/, "");
      if (/^\d{6,}$/.test(clean)) out.push(clean);
    }
  }
  return out;
}

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function collectModIdsFromLaunchAndDb(server: any) {
  const fromLaunch = [
    ...parseLaunchParamValues(server.launchParams ?? "", "mod"),
    ...parseLaunchParamValues(server.launchParams ?? "", "serverMod")
  ];
  const fromDb = (getDb().prepare("SELECT workshop_id as workshopId, folder_name as folderName FROM mods WHERE server_id = ? AND enabled = 1 ORDER BY load_order ASC").all(server.id) as Array<{ workshopId?: string; folderName: string }>)
    .flatMap((row) => [row.workshopId, /^\d{6,}$/.test(row.folderName) ? row.folderName : ""])
    .filter((value): value is string => Boolean(value && /^\d{6,}$/.test(value)));
  return uniq([...fromLaunch, ...fromDb]);
}

async function copyWorkshopItemToServer(server: any, workshopId: string) {
  const source = path.join(workshopStagingRoot(server), "steamapps", "workshop", "content", DAYZ_WORKSHOP_APP_ID, workshopId);
  const destination = path.join(server.rootPath, workshopId);
  if (!await exists(source)) return false;
  await fs.cp(source, destination, { recursive: true, force: true });
  const sourceKeys = path.join(destination, "keys");
  const targetKeys = path.join(server.rootPath, "keys");
  try {
    await fs.mkdir(targetKeys, { recursive: true });
    const keyFiles = await fs.readdir(sourceKeys);
    for (const key of keyFiles.filter((name) => name.toLowerCase().endsWith(".bikey"))) {
      await fs.copyFile(path.join(sourceKeys, key), path.join(targetKeys, key));
    }
  } catch {
    // Some mods do not ship keys; diagnostics will flag that separately.
  }
  return true;
}

async function runSteamCmd(file: string, args: string[]) {
  const result = await runSteamCmdSerialized(file, args, { timeoutMs: UPDATE_TIMEOUT_MS, label: `${file} ${redactSteamCmdArgs(args).join(" ")}` });
  return { exitCode: result.exitCode, output: result.output };
}

function registerNumericWorkshopMod(serverId: string, workshopId: string) {
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT OR IGNORE INTO mods (id, server_id, folder_name, display_name, workshop_id, enabled, load_order, has_keys, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, (SELECT COALESCE(MAX(load_order) + 1, 0) FROM mods WHERE server_id = ?), 0, ?, ?)
  `).run(`${serverId}:${workshopId}`, serverId, workshopId, workshopId, workshopId, serverId, now, now);
  getDb().prepare("UPDATE mods SET workshop_id = ?, updated_at = ? WHERE server_id = ? AND folder_name = ?")
    .run(workshopId, now, serverId, workshopId);
}


async function dirStatSummary(root: string) {
  try {
    const stat = await fs.stat(root);
    let fileCount = 0;
    let totalBytes = 0;
    async function walk(current: string, depth = 0) {
      if (depth > 5 || fileCount > 20_000) return;
      let entries: import("node:fs").Dirent[] = [];
      try { entries = await fs.readdir(current, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) await walk(full, depth + 1);
        else if (entry.isFile()) {
          fileCount += 1;
          try { totalBytes += (await fs.stat(full)).size; } catch { /* ignore */ }
        }
      }
    }
    await walk(root);
    return { exists: true, path: root, lastWriteTime: stat.mtime.toISOString(), mtimeMs: stat.mtimeMs, fileCount, totalBytes };
  } catch {
    return { exists: false, path: root };
  }
}

async function listDirectFiles(root: string, matcher: (name: string) => boolean) {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && matcher(entry.name)).map((entry) => entry.name).sort();
  } catch { return []; }
}

async function listRecursiveBasenames(root: string, matcher: (name: string) => boolean, limit = 120) {
  const out: string[] = [];
  async function walk(current: string, depth = 0) {
    if (depth > 4 || out.length >= limit) return;
    let entries: import("node:fs").Dirent[] = [];
    try { entries = await fs.readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (out.length >= limit) break;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else if (entry.isFile() && matcher(entry.name)) out.push(path.basename(full));
    }
  }
  await walk(root);
  return [...new Set(out)].sort();
}

async function readModDisplayName(modPath: string) {
  for (const file of [path.join(modPath, "mod.cpp"), path.join(modPath, "meta.cpp")]) {
    try {
      const stat = await fs.stat(file);
      if (stat.size > 256_000) continue;
      const text = await fs.readFile(file, "utf8");
      const name = text.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1]
        || text.match(/\bname\s*=\s*([^;\r\n]+)/i)?.[1]?.trim();
      if (name) return name.replace(/^"|"$/g, "");
    } catch { /* try next */ }
  }
  return "";
}

async function workshopSyncReport(server: any) {
  const modRows = getDb().prepare(`
    SELECT folder_name as folderName, display_name as displayName, workshop_id as workshopId, enabled, load_order as loadOrder, has_keys as hasKeys
    FROM mods WHERE server_id = ? ORDER BY load_order ASC, folder_name ASC
  `).all(server.id) as Array<{ folderName: string; displayName?: string; workshopId?: string; enabled: number; loadOrder: number; hasKeys: number }>;
  const launchIds = new Set([
    ...parseLaunchParamValues(server.launchParams ?? "", "mod"),
    ...parseLaunchParamValues(server.launchParams ?? "", "serverMod")
  ]);
  const byWorkshopId = new Map<string, typeof modRows[number]>();
  for (const row of modRows) {
    const id = row.workshopId || (/^\d{6,}$/.test(row.folderName) ? row.folderName : "");
    if (id) byWorkshopId.set(id, row);
  }
  const ids = uniq([...launchIds, ...byWorkshopId.keys()]);
  const serverKeysPath = path.join(server.rootPath, "keys");
  const serverKeys = new Set((await listDirectFiles(serverKeysPath, (name) => name.toLowerCase().endsWith(".bikey"))).map((name) => name.toLowerCase()));
  const items = [];
  for (const workshopId of ids) {
    const row = byWorkshopId.get(workshopId);
    const folderName = row?.folderName || workshopId;
    const serverPath = path.join(server.rootPath, folderName);
    const stagingPath = path.join(workshopStagingRoot(server), "steamapps", "workshop", "content", DAYZ_WORKSHOP_APP_ID, workshopId);
    const serverStat = await dirStatSummary(serverPath);
    const stagingStat = await dirStatSummary(stagingPath);
    const modName = serverStat.exists ? await readModDisplayName(serverPath) : stagingStat.exists ? await readModDisplayName(stagingPath) : "";
    const keyNames = serverStat.exists ? await listRecursiveBasenames(path.join(serverPath, "keys"), (name) => name.toLowerCase().endsWith(".bikey"), 80) : [];
    const copiedKeys = keyNames.filter((name) => serverKeys.has(name.toLowerCase()));
    const pboHints = serverStat.exists ? await listRecursiveBasenames(path.join(serverPath, "addons"), (name) => name.toLowerCase().endsWith(".pbo"), 80) : [];
    const flags: string[] = [];
    if (!serverStat.exists) flags.push("missing_server_folder");
    if (!stagingStat.exists) flags.push("missing_staging_download");
    if (stagingStat.exists && serverStat.exists && Number(stagingStat.mtimeMs || 0) > Number(serverStat.mtimeMs || 0) + 1000) flags.push("staging_newer_than_server");
    if (!keyNames.length) flags.push("mod_has_no_bikey");
    if (keyNames.length && copiedKeys.length < keyNames.length) flags.push("server_keys_not_synced");
    if ([folderName, row?.displayName || "", modName, ...pboHints].join(" ").toLowerCase().includes("expansion")) flags.push("expansion_related");
    items.push({ workshopId, folderName, displayName: row?.displayName || folderName, modName, enabled: row?.enabled ?? (launchIds.has(workshopId) ? 1 : 0), loadOrder: row?.loadOrder ?? 9999, inLaunchProfile: launchIds.has(workshopId), inModTable: Boolean(row), server: serverStat, staging: stagingStat, keyCount: keyNames.length, copiedKeyCount: copiedKeys.length, pboHints, flags });
  }
  const summary = {
    total: items.length,
    enabled: items.filter((item) => item.enabled).length,
    launchProfileIds: launchIds.size,
    missingServerFolders: items.filter((item) => item.flags.includes("missing_server_folder")).length,
    missingStagingDownloads: items.filter((item) => item.flags.includes("missing_staging_download")).length,
    stagingNewerThanServer: items.filter((item) => item.flags.includes("staging_newer_than_server")).length,
    keyProblems: items.filter((item) => item.flags.includes("mod_has_no_bikey") || item.flags.includes("server_keys_not_synced")).length,
    expansionRelated: items.filter((item) => item.flags.includes("expansion_related")).length
  };
  return { serverId: server.id, rootPath: server.rootPath, steamcmdPath: resolveSteamCmdPath(server), workshopAppId: DAYZ_WORKSHOP_APP_ID, workshopStagingRoot: workshopStagingRoot(server), serverKeysPath, summary, items };
}

async function updaterPreflight(server: any) {
  const steamcmdPath = resolveSteamCmdPath(server);
  const running = await isRunning(server.id);
  const modIds = collectModIdsFromLaunchAndDb(server);
  const checks = [
    { name: "steamcmd", status: await exists(steamcmdPath) ? "pass" : "fail", message: steamcmdPath },
    { name: "server_stopped", status: running ? "fail" : "pass", message: running ? "Server is running. Stop it before updating server binaries or mods." : "Server is stopped." },
    { name: "dedicated_server_app", status: "pass", message: `DayZ Dedicated Server AppID ${DAYZ_DEDICATED_SERVER_APP_ID}` },
    { name: "install_dir", status: await exists(server.rootPath) ? "pass" : "fail", message: server.rootPath },
    { name: "workshop_staging", status: "pass", message: workshopStagingRoot(server) },
    { name: "mod_ids", status: modIds.length ? "pass" : "warn", message: modIds.length ? `${modIds.length} Workshop IDs found in launch profile / mod table.` : "No numeric Workshop IDs found yet. Run Launch Profile Import or Mods scan first." }
  ];
  return { ok: !checks.some((check) => check.status === "fail"), steamcmdPath, appId: DAYZ_DEDICATED_SERVER_APP_ID, workshopAppId: DAYZ_WORKSHOP_APP_ID, installDir: server.rootPath, workshopStagingRoot: workshopStagingRoot(server), modIds, auth: { supportsSteamLogin: true, storesPassword: false, envUsernameConfigured: Boolean(process.env.DAYZ_AIO_STEAM_USERNAME) }, checks };
}

export async function updateRoutes(app: FastifyInstance) {
  app.get("/api/updates/jobs", async (request) => {
    const query = request.query as { serverId?: string };
    return { items: [...jobs.values()].filter((job) => !query.serverId || job.serverId === query.serverId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  });

  app.get("/api/updates/steamcmd-queue", async () => ({ queue: getSteamCmdQueueState() }));

  app.get("/api/updates/jobs/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = jobs.get(jobId);
    if (!job) return reply.code(404).send({ error: "Update job not found" });
    return job;
  });

  app.get("/api/servers/:serverId/updates/preflight", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const server = requireServer(serverId);
      return await updaterPreflight(server);
    } catch (error) { return sendError(reply, error); }
  });


  app.get("/api/servers/:serverId/updates/server-state", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const server = requireServer(serverId);
      return {
        exe: await getServerExeSnapshot(server),
        manifest: await readAppManifestSummary(server),
        steamcmdPath: resolveSteamCmdPath(server),
        installDir: server.rootPath,
        appId: DAYZ_DEDICATED_SERVER_APP_ID
      };
    } catch (error) { return sendError(reply, error); }
  });

  app.get("/api/servers/:serverId/updates/workshop-sync-report", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const server = requireServer(serverId);
      return await workshopSyncReport(server);
    } catch (error) { return sendError(reply, error); }
  });

  app.post("/api/servers/:serverId/updates/workshop-sync-from-staging", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const server = requireServer(serverId);
      const preflight = await updaterPreflight(server);
      if (preflight.checks.some((check) => check.name === "server_stopped" && check.status === "fail")) return reply.code(400).send({ error: "Stop the DayZ server before syncing Workshop folders from staging.", preflight });
      const modIds = preflight.modIds;
      const results: Array<{ workshopId: string; copied: boolean }> = [];
      for (const workshopId of modIds) {
        const copied = await copyWorkshopItemToServer(server, workshopId);
        if (copied) registerNumericWorkshopMod(serverId, workshopId);
        results.push({ workshopId, copied });
      }
      const report = await workshopSyncReport(server);
      writeAudit({ serverId, action: "updates.workshop_sync_from_staging", target: "workshop staging", metadata: { total: results.length, copied: results.filter((item) => item.copied).length } });
      return { ok: results.every((item) => item.copied), results, report };
    } catch (error) { return sendError(reply, error); }
  });

  app.post("/api/servers/:serverId/updates/server", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const authInput = updateAuthSchema.parse(request.body) || {};
      const auth = resolveSteamLogin(authInput);
      const server = requireServer(serverId);
      const preflight = await updaterPreflight(server);
      if (preflight.checks.some((check) => check.name === "server_stopped" && check.status === "fail")) return reply.code(400).send({ error: "Stop the DayZ server before updating server binaries.", preflight });
      if (!await exists(preflight.steamcmdPath)) return reply.code(400).send({ error: `SteamCMD not found: ${preflight.steamcmdPath}`, preflight });
      const job: UpdateJob = { id: crypto.randomUUID(), serverId, action: "server-update", status: "queued", total: 1, completed: 0, failed: 0, results: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      enqueueUpdateJob(job, async () => {
        updateJob(job, { current: DAYZ_DEDICATED_SERVER_APP_ID });
        const beforeExe = await getServerExeSnapshot(server);
        const beforeManifest = await readAppManifestSummary(server);
        const args = ["+force_install_dir", server.rootPath, ...buildSteamCmdArgs(auth, ["+app_update", DAYZ_DEDICATED_SERVER_APP_ID, "validate", "+quit"])] ;
        const result = await runSteamCmd(preflight.steamcmdPath, args);
        const steam = parseSteamCmdOutput(result.output);
        const steamFailure = steamFailureReason(result.exitCode, steam);
        const afterExe = await getServerExeSnapshot(server);
        const afterManifest = await readAppManifestSummary(server);
        const changed = serverExeChanged(beforeExe, afterExe);
        const exePresent = afterExe.exists;
        const verification = {
          ok: !steamFailure && exePresent && changed,
          reason: steamFailure
            ? steamFailure
            : !exePresent
              ? "dayz_server_exe_missing_after_update"
              : !changed
                ? "dayz_server_exe_unchanged_after_update"
                : "dayz_server_exe_changed",
          beforeExe,
          afterExe,
          beforeManifest,
          afterManifest,
          authMode: auth.mode,
          steam,
          command: `${preflight.steamcmdPath} ${redactSteamCmdArgs(args).join(" ")}`
        };
        const failed = verification.ok ? 0 : 1;
        job.results.push({ target: `app_update ${DAYZ_DEDICATED_SERVER_APP_ID}`, exitCode: result.exitCode, outputTail: result.output.slice(-8000), verification, steam });
        updateJob(job, { completed: 1, failed, results: job.results, error: failed ? `Update verification failed: ${verification.reason}` : undefined });
        writeAudit({ serverId, action: failed ? "updates.server.failed" : "updates.server", target: DAYZ_DEDICATED_SERVER_APP_ID, metadata: { jobId: job.id, exitCode: result.exitCode, steamcmdPath: preflight.steamcmdPath, installDir: server.rootPath, verification } });
      });
      return reply.code(202).send({ ok: true, queued: true, jobId: job.id, preflight });
    } catch (error) { return sendError(reply, error); }
  });

  app.post("/api/servers/:serverId/updates/mods", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const authInput = updateAuthSchema.parse(request.body) || {};
      const auth = resolveSteamLogin(authInput);
      const server = requireServer(serverId);
      const preflight = await updaterPreflight(server);
      if (preflight.checks.some((check) => check.name === "server_stopped" && check.status === "fail")) return reply.code(400).send({ error: "Stop the DayZ server before updating Workshop mods.", preflight });
      if (!await exists(preflight.steamcmdPath)) return reply.code(400).send({ error: `SteamCMD not found: ${preflight.steamcmdPath}`, preflight });
      const modIds = preflight.modIds;
      if (!modIds.length) return reply.code(400).send({ error: "No Workshop IDs found. Run Launch Profile Import or Mods scan first.", preflight });
      await fs.mkdir(workshopStagingRoot(server), { recursive: true });
      const job: UpdateJob = { id: crypto.randomUUID(), serverId, action: "mods-update", status: "queued", total: modIds.length, completed: 0, failed: 0, results: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      enqueueUpdateJob(job, async () => {
        for (const workshopId of modIds) {
          updateJob(job, { current: workshopId });
          const args = ["+force_install_dir", workshopStagingRoot(server), ...buildSteamCmdArgs(auth, ["+workshop_download_item", DAYZ_WORKSHOP_APP_ID, workshopId, "validate", "+quit"])] ;
          const result = await runSteamCmd(preflight.steamcmdPath, args);
          const steam = parseSteamCmdOutput(result.output);
          const steamFailure = steamFailureReason(result.exitCode, steam);
          const copied = !steamFailure ? await copyWorkshopItemToServer(server, workshopId) : false;
          if (copied) registerNumericWorkshopMod(serverId, workshopId);
          const failed = !steamFailure && copied ? 0 : 1;
          const verification = { ok: failed === 0, reason: steamFailure || (!copied ? "workshop_item_not_copied_after_download" : "workshop_item_copied"), authMode: auth.mode, steam, command: `${preflight.steamcmdPath} ${redactSteamCmdArgs(args).join(" ")}` };
          job.results.push({ target: `workshop ${workshopId}`, exitCode: result.exitCode, outputTail: result.output.slice(-5000), copied, verification, steam });
          updateJob(job, { completed: job.completed + 1, failed: job.failed + failed, results: job.results });
        }
        writeAudit({ serverId, action: job.failed ? "updates.mods.failed" : "updates.mods", target: "workshop mods", metadata: { jobId: job.id, total: job.total, failed: job.failed, workshopStagingRoot: workshopStagingRoot(server) } });
      });
      return reply.code(202).send({ ok: true, queued: true, jobId: job.id, count: modIds.length, preflight });
    } catch (error) { return sendError(reply, error); }
  });
}
