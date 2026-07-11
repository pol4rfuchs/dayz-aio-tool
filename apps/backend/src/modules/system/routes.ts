import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getDb } from "../../db/database.js";
import { sendError } from "../../shared/errors.js";
import { requireServer } from "../servers/repository.js";
import { createBackup, restoreBackup } from "../backups/service.js";
import { readServerDz, saveServerDz } from "../config/serverDz.js";
import { validateTypesXml } from "../economy/parser.js";
import { startServer, stopServer } from "../process/service.js";
import { writeAudit } from "../audit/service.js";

async function checkFile(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    return { ok: stat.isFile(), path: filePath, size: stat.size };
  } catch (error) { return { ok: false, path: filePath, error: (error as Error).message }; }
}

export async function systemRoutes(app: FastifyInstance) {
  app.get("/api/system/health", async () => ({ ok: true, now: new Date().toISOString(), platform: process.platform, node: process.version }));

  app.post("/api/servers/:serverId/tests/safety", async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const id = crypto.randomUUID();
    try {
      const server = requireServer(serverId);
      const results: any[] = [];
      results.push({ name: "serverDZ.cfg exists", ...(await checkFile(path.join(server.rootPath, "serverDZ.cfg"))) });
      const typesPath = path.join(server.missionPath, "db", "types.xml");
      results.push({ name: "types.xml exists", ...(await checkFile(typesPath)) });
      const backup = await createBackup({ serverId, type: "test", reason: "automated safety test", files: [path.join(server.rootPath, "serverDZ.cfg"), typesPath] });
      results.push({ name: "backup create", ok: true, backupId: backup.id });
      const serverDz = await readServerDz(serverId);
      await saveServerDz(serverId, `${serverDz}\n// DayZ AIO safety test ${id}\n`);
      results.push({ name: "serverDZ.cfg write", ok: true });
      await restoreBackup(serverId, backup.id);
      results.push({ name: "backup restore", ok: true });
      const xml = await fs.readFile(typesPath, "utf8");
      results.push({ name: "types.xml validation", ...validateTypesXml(xml) });
      const status = results.every((result) => result.ok !== false && result.valid !== false) ? "passed" : "failed";
      getDb().prepare("INSERT INTO test_runs (id, server_id, name, status, result, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, serverId, "safety", status, JSON.stringify(results), new Date().toISOString());
      writeAudit({ serverId, action: "test.safety", target: status, metadata: results });
      return { id, status, results };
    } catch (error) {
      getDb().prepare("INSERT INTO test_runs (id, server_id, name, status, result, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, serverId, "safety", "failed", JSON.stringify({ error: (error as Error).message }), new Date().toISOString());
      return sendError(reply, error);
    }
  });

  app.post("/api/servers/:serverId/tests/start-stop", async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    try {
      const started = await startServer(serverId);
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const stopped = await stopServer(serverId);
      return { ok: true, started, stopped };
    } catch (error) { return sendError(reply, error); }
  });

  app.get("/api/servers/:serverId/tests", async (request) => {
    const { serverId } = request.params as { serverId: string };
    return { items: getDb().prepare("SELECT id, name, status, result, created_at as createdAt FROM test_runs WHERE server_id = ? ORDER BY created_at DESC LIMIT 50").all(serverId) };
  });
}
