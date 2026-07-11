import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { requireServer } from "../servers/repository.js";
import { sendError } from "../../shared/errors.js";
import { assertInsideRoot } from "../../shared/pathGuard.js";
import { getLogs } from "../process/service.js";

const LOG_FILE = /(?:^|[-_])(script|crash|error|server|console)|\.rpt$|\.adm$|\.log$/i;

async function safeStat(file: string) { try { return await fs.lstat(file); } catch { return null; } }

async function collectLogFiles(root: string, max = 500) {
  const files: Array<{ path: string; name: string; size: number; modifiedAt: string }> = [];
  const rootSafe = path.resolve(root);
  async function walk(current: string) {
    if (files.length >= max) return;
    let entries: import("node:fs").Dirent[] = [];
    try { entries = await fs.readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= max) break;
      const full = path.join(current, entry.name);
      const stat = await safeStat(full);
      if (!stat || stat.isSymbolicLink()) continue;
      try { assertInsideRoot(rootSafe, full); } catch { continue; }
      if (stat.isDirectory()) {
        if (/node_modules|steamapps|workshop|backup|backups/i.test(entry.name)) continue;
        await walk(full);
      } else if (stat.isFile() && LOG_FILE.test(entry.name)) {
        files.push({ path: full, name: entry.name, size: stat.size, modifiedAt: stat.mtime.toISOString() });
      }
    }
  }
  await walk(rootSafe);
  return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, max);
}

async function tail(file: string, maxBytes: number) {
  const stat = await fs.lstat(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw Object.assign(new Error("Refusing to read non-file log target."), { statusCode: 400 });
  const handle = await fs.open(file, "r");
  try {
    const start = Math.max(0, stat.size - maxBytes);
    const buffer = Buffer.alloc(stat.size - start);
    await handle.read(buffer, 0, buffer.length, start);
    return buffer.toString("utf8");
  } finally { await handle.close(); }
}

export async function logRoutes(app: FastifyInstance) {
  app.get("/api/servers/:serverId/live-logs", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const server = requireServer(serverId);
      const roots = [...new Set([server.profilePath, server.rootPath].filter(Boolean))];
      const files = [];
      for (const root of roots) {
        const safe = root === server.rootPath ? server.rootPath : assertInsideRoot(server.rootPath, root);
        files.push(...await collectLogFiles(safe, 300));
      }
      return { runtime: getLogs(serverId, 240), files: files.slice(0, 80), generatedAt: new Date().toISOString() };
    } catch (error) { return sendError(reply, error); }
  });

  app.get("/api/servers/:serverId/live-logs/file", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const file = String((request.query as any).path ?? "");
      const bytes = Math.min(Math.max(Number((request.query as any).bytes ?? 24000), 1000), 250000);
      const server = requireServer(serverId);
      const safe = assertInsideRoot(server.rootPath, file);
      return { path: safe, tail: await tail(safe, bytes), bytes };
    } catch (error) { return sendError(reply, error); }
  });
}
