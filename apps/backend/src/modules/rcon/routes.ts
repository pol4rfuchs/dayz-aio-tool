import type { FastifyInstance } from "fastify";
import * as dgram from "node:dgram";
import { z } from "zod";
import { sendError } from "../../shared/errors.js";
import { BATTLEYE_RCON_ENABLED, RCON_TIMEOUT_MS } from "../../shared/env.js";
import { decryptSecret } from "../../shared/secrets.js";
import { requireServer } from "../servers/repository.js";
import { writeAudit } from "../audit/service.js";
import { sendBattleyeRconCommand } from "./battleye.js";

const commandSchema = z.object({ command: z.string().min(1).max(500) });
const playerActionSchema = z.object({ playerId: z.string().min(1).max(80), reason: z.string().max(240).optional().default("") });

const ALLOWLIST = /^(players|say\s+.+|kick\s+\S+.*|ban\s+\S+.*|missions|shutdown|restart)$/i;

async function sendUdpProbe(host: string, port: number, payload: Buffer, timeoutMs = 2500) {
  return new Promise<{ ok: boolean; response?: string; timedOut?: boolean }>((resolve) => {
    const socket = dgram.createSocket("udp4");
    const timer = setTimeout(() => { socket.close(); resolve({ ok: false, timedOut: true }); }, timeoutMs);
    socket.on("message", (msg) => { clearTimeout(timer); socket.close(); resolve({ ok: true, response: msg.toString("utf8") }); });
    socket.on("error", () => { clearTimeout(timer); socket.close(); resolve({ ok: false }); });
    socket.send(payload, port, host);
  });
}

function rconConfig(serverId: string) {
  const server = requireServer(serverId);
  const password = decryptSecret(server.rconPassword);
  if (!server.rconHost || !server.rconPort || !password) throw Object.assign(new Error("RCON is not configured for this server."), { statusCode: 400 });
  return { server, host: server.rconHost, port: Number(server.rconPort), password };
}

async function runRcon(serverId: string, command: string) {
  if (!ALLOWLIST.test(command.trim())) throw Object.assign(new Error("Command blocked by RCON allowlist."), { statusCode: 400 });
  if (!BATTLEYE_RCON_ENABLED) {
    throw Object.assign(new Error("BattlEye RCON command execution is disabled. Set DAYZ_AIO_BATTLEYE_RCON_ENABLED=true only on a test server after verifying credentials."), { statusCode: 409 });
  }
  const cfg = rconConfig(serverId);
  const result = await sendBattleyeRconCommand({ host: cfg.host, port: cfg.port, password: cfg.password, command, timeoutMs: RCON_TIMEOUT_MS });
  writeAudit({ serverId, action: "rcon.command", target: command.replace(cfg.password, "***"), metadata: { packets: result.packets } });
  return result;
}

export async function rconRoutes(app: FastifyInstance) {
  app.post("/api/servers/:serverId/rcon/test", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const cfg = rconConfig(serverId);
      const result = await sendUdpProbe(cfg.host, cfg.port, Buffer.from("DayZ-AIO-RCON-PROBE"));
      writeAudit({ serverId, action: "rcon.test", target: `${cfg.host}:${cfg.port}`, metadata: result });
      return { ...result, commandExecutionEnabled: BATTLEYE_RCON_ENABLED, note: "UDP reachability probe. Enable DAYZ_AIO_BATTLEYE_RCON_ENABLED=true for real BattlEye RCON command execution on a test server." };
    } catch (error) { return sendError(reply, error); }
  });

  app.post("/api/servers/:serverId/rcon/command", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const input = commandSchema.parse(request.body);
      return await runRcon(serverId, input.command.trim());
    } catch (error) { return sendError(reply, error); }
  });

  app.get("/api/servers/:serverId/rcon/players", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      return await runRcon(serverId, "players");
    } catch (error) { return sendError(reply, error); }
  });

  app.post("/api/servers/:serverId/rcon/broadcast", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const input = z.object({ message: z.string().min(1).max(240) }).parse(request.body);
      return await runRcon(serverId, `say ${input.message}`);
    } catch (error) { return sendError(reply, error); }
  });

  app.post("/api/servers/:serverId/rcon/kick", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const input = playerActionSchema.parse(request.body);
      return await runRcon(serverId, `kick ${input.playerId}${input.reason ? ` ${input.reason}` : ""}`);
    } catch (error) { return sendError(reply, error); }
  });

  app.post("/api/servers/:serverId/rcon/ban", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const input = playerActionSchema.parse(request.body);
      return await runRcon(serverId, `ban ${input.playerId}${input.reason ? ` ${input.reason}` : ""}`);
    } catch (error) { return sendError(reply, error); }
  });
}
