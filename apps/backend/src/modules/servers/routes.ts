import type { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../../db/database.js";
import { sendError } from "../../shared/errors.js";
import { getAllRuntimeStatuses, getLogs, getRuntimeStatus, getServerControlSummary, preflightStartServer, restartServer, startServer, stopServer } from "../process/service.js";
import { listServers, getServer } from "./repository.js";
import { writeAudit } from "../audit/service.js";
import { detectExistingServer } from "./detect.js";
import { detectLaunchProfile } from "./launchProfile.js";
import { encryptSecret, maskSecret } from "../../shared/secrets.js";

const createServerSchema = z.object({
  name: z.string().min(1),
  rootPath: z.string().min(1),
  profilePath: z.string().min(1).optional().default(""),
  executablePath: z.string().min(1).optional().default(""),
  missionPath: z.string().optional().default(""),
  launchParams: z.string().default(""),
  rconHost: z.string().optional().nullable(),
  rconPort: z.number().int().positive().optional().nullable(),
  rconPassword: z.string().optional().nullable(),
  steamcmdPath: z.string().optional().nullable(),
  workshopAppId: z.string().optional().default("221100")
});

const updateServerSchema = createServerSchema.partial();

function publicServer(server: any) {
  return { ...server, rconPassword: maskSecret(server.rconPassword) };
}

export async function serverRoutes(app: FastifyInstance) {
  app.get("/", async () => listServers().map(publicServer));

  app.get("/status", async () => ({ items: getAllRuntimeStatuses() }));

  app.post("/detect", async (request, reply) => {
    try { return await detectExistingServer(request.body); }
    catch (error) { return sendError(reply, error); }
  });


  app.post("/launch-profile/detect", async (request, reply) => {
    try { return await detectLaunchProfile(request.body as { rootPath: string; profilePath?: string; launchParams?: string }); }
    catch (error) { return sendError(reply, error); }
  });

  app.post("/", async (request, reply) => {
    try {
      const input = createServerSchema.parse(request.body);
      const detected = await detectExistingServer(input);
      if (!detected.valid) return reply.code(400).send({ error: "Server path validation failed", detection: detected });

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      getDb().prepare(`
        INSERT INTO servers
        (id, name, root_path, profile_path, executable_path, mission_path, launch_params, rcon_host, rcon_port, rcon_password, steamcmd_path, workshop_app_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.name,
        detected.rootPath,
        detected.profilePath,
        detected.executablePath,
        detected.missionPath,
        input.launchParams || detected.launchParams,
        input.rconHost ?? null,
        input.rconPort ?? null,
        encryptSecret(input.rconPassword ?? null),
        input.steamcmdPath ?? null,
        input.workshopAppId ?? "221100",
        now,
        now
      );
      getDb().prepare("INSERT INTO server_state (server_id, status) VALUES (?, 'stopped')").run(id);
      writeAudit({ serverId: id, action: "server.create", target: input.name, metadata: { input: { ...input, rconPassword: input.rconPassword ? "***" : null }, detection: detected } });
      reply.code(201);
      return { id, name: input.name, rootPath: detected.rootPath, profilePath: detected.profilePath, executablePath: detected.executablePath, missionPath: detected.missionPath, launchParams: input.launchParams || detected.launchParams, createdAt: now, updatedAt: now, detection: detected };
    } catch (error) { return sendError(reply, error); }
  });

  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = getServer(id);
    if (!row) return reply.code(404).send({ error: "Server not found" });
    return { ...row, rconPassword: maskSecret(row.rconPassword) };
  });


  app.post("/:id/launch-profile/import", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const current = getServer(id);
      if (!current) return reply.code(404).send({ error: "Server not found" });
      const detection = await detectLaunchProfile({ rootPath: current.rootPath, profilePath: current.profilePath, launchParams: current.launchParams });
      if (!detection.recommendedLaunchParams.trim()) {
        return reply.code(400).send({ error: "No launch profile could be generated", detection });
      }
      const now = new Date().toISOString();
      getDb().prepare("UPDATE servers SET launch_params = ?, updated_at = ? WHERE id = ?").run(detection.recommendedLaunchParams, now, id);
      const insertMod = getDb().prepare(`
        INSERT OR IGNORE INTO mods (id, server_id, folder_name, display_name, workshop_id, enabled, load_order, has_keys, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, (SELECT COALESCE(MAX(load_order) + 1, 0) FROM mods WHERE server_id = ?), 0, ?, ?)
      `);
      for (const workshopId of [...new Set([...(detection.managerMods ?? []), ...(detection.managerServerMods ?? [])])].filter((value) => /^\d{6,}$/.test(value))) {
        insertMod.run(`${id}:${workshopId}`, id, workshopId, workshopId, workshopId, id, now, now);
      }
      writeAudit({ serverId: id, action: "server.launch_profile.import", target: current.name, metadata: { source: detection.source?.filePath, warnings: detection.warnings, errors: detection.errors, importedWorkshopIds: [...new Set([...(detection.managerMods ?? []), ...(detection.managerServerMods ?? [])])].length } });
      return { ok: true, server: publicServer(getServer(id)), detection };
    } catch (error) { return sendError(reply, error); }
  });

  app.patch("/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const current = getServer(id);
      if (!current) return reply.code(404).send({ error: "Server not found" });
      const input = updateServerSchema.parse(request.body);
      const next = { ...current, ...input, updatedAt: new Date().toISOString() };
      const rconPassword = input.rconPassword === "***" ? current.rconPassword : encryptSecret(input.rconPassword ?? current.rconPassword ?? null);
      getDb().prepare(`
        UPDATE servers SET
          name = ?, root_path = ?, profile_path = ?, executable_path = ?, mission_path = ?, launch_params = ?,
          rcon_host = ?, rcon_port = ?, rcon_password = ?, steamcmd_path = ?, workshop_app_id = ?, updated_at = ?
        WHERE id = ?
      `).run(next.name, next.rootPath, next.profilePath, next.executablePath, next.missionPath, next.launchParams, next.rconHost ?? null, next.rconPort ?? null, rconPassword, next.steamcmdPath ?? null, next.workshopAppId ?? "221100", next.updatedAt, id);
      writeAudit({ serverId: id, action: "server.update", target: next.name, metadata: { ...input, rconPassword: input.rconPassword ? "***" : undefined } });
      return publicServer(getServer(id));
    } catch (error) { return sendError(reply, error); }
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!getServer(id)) return reply.code(404).send({ error: "Server not found" });
    getDb().prepare("DELETE FROM server_state WHERE server_id = ?").run(id);
    getDb().prepare("DELETE FROM mods WHERE server_id = ?").run(id);
    getDb().prepare("DELETE FROM schedules WHERE server_id = ?").run(id);
    getDb().prepare("DELETE FROM servers WHERE id = ?").run(id);
    writeAudit({ serverId: id, action: "server.delete", target: id });
    return { ok: true };
  });

  app.get("/:id/control", async (request, reply) => {
    try { return await getServerControlSummary((request.params as { id: string }).id); }
    catch (error) { return sendError(reply, error); }
  });

  app.get("/:id/start/preflight", async (request, reply) => {
    try { return await preflightStartServer((request.params as { id: string }).id); }
    catch (error) { return sendError(reply, error); }
  });

  app.post("/:id/start", async (request, reply) => {
    try { return await startServer((request.params as { id: string }).id); }
    catch (error) { return sendError(reply, error); }
  });

  app.post("/:id/stop", async (request, reply) => {
    try { return await stopServer((request.params as { id: string }).id); }
    catch (error) { return sendError(reply, error); }
  });

  app.post("/:id/restart", async (request, reply) => {
    try { return await restartServer((request.params as { id: string }).id); }
    catch (error) { return sendError(reply, error); }
  });

  app.get("/:id/status", async (request) => getRuntimeStatus((request.params as { id: string }).id));
  app.get("/:id/logs", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string };
    return { lines: getLogs(id, Number(query.limit ?? 300)) };
  });
}
