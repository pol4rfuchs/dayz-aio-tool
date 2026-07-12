import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { runSteamCmd as runSteamCmdSerialized, workshopTimeoutMs } from "../updates/steamcmd.js";
import { buildSteamCmdArgs, redactSteamCmdArgs, redactSteamCmdOutputTail, resolveSteamLogin, steamAuthSchema } from "../updates/auth.js";
import { z } from "zod";
import { getDb } from "../../db/database.js";
import { sendError } from "../../shared/errors.js";
import { requireServer } from "../servers/repository.js";
import { writeAudit } from "../audit/service.js";
import { broadcast } from "../realtime/hub.js";
import { WORKSHOP_JOB_HISTORY_LIMIT } from "../../shared/env.js";

const installSchema = z.object({ workshopId: z.string().regex(/^\d+$/), folderName: z.string().optional() }).and(steamAuthSchema.unwrap());
const updateEnabledSchema = steamAuthSchema;

type WorkshopJob = {
  id: string;
  serverId: string;
  action: "install" | "update-enabled";
  status: "queued" | "running" | "completed" | "failed";
  total: number;
  completed: number;
  failed: number;
  current?: string;
  results: Array<{ workshopId: string; folderName?: string; exitCode: number; outputTail: string }>;
  error?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
};

const jobs = new Map<string, WorkshopJob>();
let jobChain: Promise<void> = Promise.resolve();

function rememberJob(job: WorkshopJob) {
  jobs.set(job.id, job);
  const all = [...jobs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  while (all.length > WORKSHOP_JOB_HISTORY_LIMIT) {
    const index = all.findIndex((candidate) => candidate.status !== "running");
    if (index < 0) break;
    const [old] = all.splice(index, 1);
    if (old) jobs.delete(old.id);
  }
}

function updateJob(job: WorkshopJob, patch: Partial<WorkshopJob>) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  jobs.set(job.id, job);
  broadcast("workshop.job.updated", job, job.serverId);
}

function steamArgs(rootPath: string, workshopAppId: string, workshopId: string, authInput?: unknown) {
  const auth = resolveSteamLogin(steamAuthSchema.parse(authInput) || {});
  return ["+force_install_dir", rootPath, ...buildSteamCmdArgs(auth, ["+workshop_download_item", workshopAppId, workshopId, "+quit"])];
}

async function runSteamCmd(server: any, workshopId: string, authInput?: unknown) {
  if (!server.steamcmdPath) throw Object.assign(new Error("steamcmdPath is not configured for this server."), { statusCode: 400 });
  await fs.access(server.steamcmdPath);
  const workshopAppId = server.workshopAppId || "221100";
  const args = steamArgs(server.rootPath, workshopAppId, workshopId, authInput);
  const result = await runSteamCmdSerialized(server.steamcmdPath, args, { timeoutMs: workshopTimeoutMs(), label: `${server.steamcmdPath} ${redactSteamCmdArgs(args).join(" ")}` });
  return { exitCode: result.exitCode, output: result.output, args: redactSteamCmdArgs(args) };
}

async function workshopPreflight(server: any) {
  const checks: Array<{ name: string; status: "pass" | "warn" | "fail"; message: string }> = [];
  if (!server.steamcmdPath) checks.push({ name: "steamcmd_path", status: "fail", message: "steamcmdPath is not configured on this server." });
  else {
    try { await fs.access(server.steamcmdPath); checks.push({ name: "steamcmd_path", status: "pass", message: server.steamcmdPath }); }
    catch { checks.push({ name: "steamcmd_path", status: "fail", message: `SteamCMD not found: ${server.steamcmdPath}` }); }
  }
  try { await fs.access(server.rootPath); checks.push({ name: "root_path", status: "pass", message: server.rootPath }); }
  catch { checks.push({ name: "root_path", status: "fail", message: `Server root missing: ${server.rootPath}` }); }
  checks.push({ name: "workshop_app_id", status: server.workshopAppId ? "pass" : "warn", message: server.workshopAppId || "Missing; fallback would be 221100" });
  const steamapps = path.join(server.rootPath, "steamapps");
  try { await fs.access(steamapps); checks.push({ name: "steamapps", status: "pass", message: steamapps }); }
  catch { checks.push({ name: "steamapps", status: "warn", message: `steamapps folder not found yet. SteamCMD may create it: ${steamapps}` }); }
  return { ok: !checks.some((c) => c.status === "fail"), checks };
}

function enqueueWorkshopJob(job: WorkshopJob, runner: () => Promise<void>) {
  rememberJob(job);
  jobChain = jobChain.then(async () => {
    updateJob(job, { status: "running" });
    try {
      await runner();
      updateJob(job, { status: job.failed > 0 ? "failed" : "completed", finishedAt: new Date().toISOString() });
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      updateJob(job, { status: "failed", error: message, finishedAt: new Date().toISOString() });
      writeAudit({ serverId: job.serverId, action: "workshop.job.failed", target: job.action, metadata: { jobId: job.id, error: message } });
    }
  }, async () => {
    updateJob(job, { status: "running" });
    await runner();
  });
  return job;
}

async function registerInstalledMod(serverId: string, workshopId: string, folderName: string) {
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT OR IGNORE INTO mods (id, server_id, folder_name, display_name, workshop_id, enabled, load_order, has_keys, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, (SELECT COALESCE(MAX(load_order) + 1, 0) FROM mods WHERE server_id = ?), 0, ?, ?)
  `).run(`${serverId}:${folderName}`, serverId, folderName, folderName.replace(/^@/, ""), workshopId, serverId, now, now);
}

export async function workshopRoutes(app: FastifyInstance) {
  app.get("/api/workshop/jobs", async (request) => {
    const query = request.query as { serverId?: string };
    const items = [...jobs.values()].filter((job) => !query.serverId || job.serverId === query.serverId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items };
  });

  app.get("/api/workshop/jobs/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = jobs.get(jobId);
    if (!job) return reply.code(404).send({ error: "Workshop job not found" });
    return job;
  });

  app.get("/api/servers/:serverId/workshop/preflight", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const server = requireServer(serverId);
      return await workshopPreflight(server);
    } catch (error) { return sendError(reply, error); }
  });

  app.post("/api/servers/:serverId/workshop/install", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const server = requireServer(serverId);
      const input = installSchema.parse(request.body);
      const folderName = input.folderName || `@${input.workshopId}`;
      const job: WorkshopJob = { id: crypto.randomUUID(), serverId, action: "install", status: "queued", total: 1, completed: 0, failed: 0, results: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      enqueueWorkshopJob(job, async () => {
        updateJob(job, { current: input.workshopId });
        broadcast("workshop.install.started", { workshopId: input.workshopId, jobId: job.id }, serverId);
        const result = await runSteamCmd(server, input.workshopId, input);
        const ok = result.exitCode === 0;
        job.results.push({ workshopId: input.workshopId, folderName, exitCode: result.exitCode, outputTail: redactSteamCmdOutputTail(result.output, resolveSteamLogin(input), 4000) });
        updateJob(job, { completed: 1, failed: ok ? 0 : 1, results: job.results });
        writeAudit({ serverId, action: ok ? "workshop.install" : "workshop.install.failed", target: input.workshopId, metadata: { jobId: job.id, exitCode: result.exitCode, outputTail: redactSteamCmdOutputTail(result.output, resolveSteamLogin(input), 4000) } });
        broadcast("workshop.install.finished", { workshopId: input.workshopId, exitCode: result.exitCode, jobId: job.id }, serverId);
        if (ok) await registerInstalledMod(serverId, input.workshopId, folderName);
      });
      return reply.code(202).send({ ok: true, queued: true, jobId: job.id, status: job.status, folderName });
    } catch (error) { return sendError(reply, error); }
  });

  app.post("/api/servers/:serverId/workshop/update-enabled", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const input = updateEnabledSchema.parse(request.body) || { steamLoginMode: "anonymous" };
      const server = requireServer(serverId);
      const rows = getDb().prepare("SELECT workshop_id as workshopId, folder_name as folderName FROM mods WHERE server_id = ? AND enabled = 1 AND workshop_id IS NOT NULL AND workshop_id != '' ORDER BY load_order ASC").all(serverId) as Array<{ workshopId: string; folderName: string }>;
      const job: WorkshopJob = { id: crypto.randomUUID(), serverId, action: "update-enabled", status: "queued", total: rows.length, completed: 0, failed: 0, results: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      enqueueWorkshopJob(job, async () => {
        for (const row of rows) {
          updateJob(job, { current: row.workshopId });
          broadcast("workshop.update.started", { workshopId: row.workshopId, folderName: row.folderName, jobId: job.id }, serverId);
          const result = await runSteamCmd(server, row.workshopId, input);
          const failed = result.exitCode !== 0 ? 1 : 0;
          job.results.push({ workshopId: row.workshopId, folderName: row.folderName, exitCode: result.exitCode, outputTail: redactSteamCmdOutputTail(result.output, resolveSteamLogin(input), 2000) });
          updateJob(job, { completed: job.completed + 1, failed: job.failed + failed, results: job.results });
          broadcast("workshop.update.finished", { workshopId: row.workshopId, exitCode: result.exitCode, jobId: job.id }, serverId);
        }
        writeAudit({ serverId, action: job.failed ? "workshop.update_enabled.failed" : "workshop.update_enabled", target: "enabled mods", metadata: { jobId: job.id, count: rows.length, failed: job.failed } });
      });
      return reply.code(202).send({ ok: true, queued: true, jobId: job.id, count: rows.length });
    } catch (error) { return sendError(reply, error); }
  });
}
