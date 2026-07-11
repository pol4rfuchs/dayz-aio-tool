import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { sendError } from "../../shared/errors.js";
import { writeTextFileWithBackup } from "../files/safeWrite.js";
import { lineDiff } from "../diff/service.js";
import { formatValidationSummary, validateTypesXml, parseTypesXml, updateTypesXmlFromItems, parseXml } from "../economy/parser.js";
import { requireServer } from "../servers/repository.js";
import { getRuntimeStatus, getLogs } from "../process/service.js";
import { writeAudit } from "../audit/service.js";
import { listBackups } from "../backups/service.js";

const analyzerSchema = z.object({ question: z.string().min(3).max(1000) });
const dynamicRuleSchema = z.object({
  category: z.enum(["food", "weapons", "medical", "tools", "all"]),
  multiplier: z.number().min(0).max(10),
  dryRun: z.boolean().optional().default(true),
  confirm: z.string().optional().default("")
});

function classify(name: string, category = "") {
  const s = `${name} ${category}`.toLowerCase();
  if (/food|can|meat|fruit|drink|soda|water/.test(s)) return "food";
  if (/weapon|rifle|pistol|shotgun|ak|m4|mosin|sks|ammo|magazine/.test(s)) return "weapons";
  if (/medical|bandage|saline|blood|morphine|epinephrine|charcoal|vitamin/.test(s)) return "medical";
  if (/tool|knife|axe|hammer|shovel|wrench|saw/.test(s)) return "tools";
  return "other";
}

async function readTypes(serverId: string) {
  const server = requireServer(serverId);
  const filePath = path.join(server.missionPath, "db", "types.xml");
  return { server, filePath, xml: await fs.readFile(filePath, "utf8") };
}

function parseEventSpawns(xml: string) {
  const parsed = parseXml(xml);
  const events = Array.isArray(parsed?.eventposdef?.event) ? parsed.eventposdef.event : parsed?.eventposdef?.event ? [parsed.eventposdef.event] : [];
  return events.flatMap((event: any) => {
    const name = String(event?.["@_name"] ?? "event");
    const positions = Array.isArray(event?.pos) ? event.pos : event?.pos ? [event.pos] : [];
    return positions.map((pos: any) => ({
      event: name,
      x: Number(pos?.["@_x"] ?? 0),
      z: Number(pos?.["@_z"] ?? 0),
      y: Number(pos?.["@_y"] ?? 0),
      a: Number(pos?.["@_a"] ?? 0)
    }));
  });
}

export async function advancedRoutes(app: FastifyInstance) {
  app.get("/api/servers/:serverId/dynamic-economy/plan", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const { xml } = await readTypes(serverId);
      const items = parseTypesXml(xml);
      const groups = items.reduce<Record<string, number>>((acc, item) => {
        const key = classify(item.name, item.category);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});
      return { mode: "guarded-preview-first", groups, supportedCategories: ["food", "weapons", "medical", "tools", "all"], note: "Use preview first. Apply requires confirm=APPLY_DYNAMIC_ECONOMY_TO_TEST_COPY and creates backup." };
    } catch (error) { return sendError(reply, error); }
  });

  app.post("/api/servers/:serverId/dynamic-economy/preview", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const input = dynamicRuleSchema.parse(request.body);
      const { xml } = await readTypes(serverId);
      const items = parseTypesXml(xml);
      const nextItems = items.map((item) => {
        const match = input.category === "all" || classify(item.name, item.category) === input.category;
        if (!match) return item;
        const nominal = Math.max(0, Math.round(item.nominal * input.multiplier));
        const min = Math.min(Math.max(0, Math.round(item.min * input.multiplier)), nominal);
        return { ...item, nominal, min };
      });
      const nextXml = updateTypesXmlFromItems(xml, nextItems);
      const changed = nextItems.filter((item, index) => item.nominal !== items[index].nominal || item.min !== items[index].min).length;
      return { changed, validation: validateTypesXml(nextXml), diff: lineDiff(xml, nextXml).slice(0, 2000), xml: nextXml };
    } catch (error) { return sendError(reply, error); }
  });

  app.post("/api/servers/:serverId/dynamic-economy/apply", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const input = dynamicRuleSchema.parse(request.body);
      if (input.confirm !== "APPLY_DYNAMIC_ECONOMY_TO_TEST_COPY") return reply.code(400).send({ error: "Apply blocked. Set confirm to APPLY_DYNAMIC_ECONOMY_TO_TEST_COPY after testing on a copied server." });
      const { filePath, xml } = await readTypes(serverId);
      const items = parseTypesXml(xml);
      const nextItems = items.map((item) => {
        const match = input.category === "all" || classify(item.name, item.category) === input.category;
        if (!match) return item;
        const nominal = Math.max(0, Math.round(item.nominal * input.multiplier));
        const min = Math.min(Math.max(0, Math.round(item.min * input.multiplier)), nominal);
        return { ...item, nominal, min };
      });
      const nextXml = updateTypesXmlFromItems(xml, nextItems);
      const validation = validateTypesXml(nextXml);
      if (!validation.valid) return reply.code(400).send(validation);
      await writeTextFileWithBackup({ serverId, filePath, backupType: "dynamic-economy", reason: `dynamic economy ${input.category} x${input.multiplier}`, content: nextXml });
      writeAudit({ serverId, action: "dynamic_economy.apply", target: input.category, metadata: { multiplier: input.multiplier, validation } });
      return { ok: true, validation };
    } catch (error) { return sendError(reply, error); }
  });

  app.get("/api/servers/:serverId/map-tools", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const server = requireServer(serverId);
      const filePath = path.join(server.missionPath, "cfgeventspawns.xml");
      let points: any[] = [];
      try { points = parseEventSpawns(await fs.readFile(filePath, "utf8")); } catch { /* optional */ }
      return { layers: ["event-spawns"], filePath, pointCount: points.length, points: points.slice(0, 2500), note: "Basic event-spawn extraction for map UI / export. Canvas editor remains guarded." };
    } catch (error) { return sendError(reply, error); }
  });

  app.post("/api/servers/:serverId/ai/analyze", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const input = analyzerSchema.parse(request.body);
      const server = requireServer(serverId);
      const status = getRuntimeStatus(serverId);
      const logs = getLogs(serverId, 200);
      const backups = listBackups(serverId).length;
      let economy: any = { valid: false, errors: ["types.xml not checked"] as string[], warnings: [] as string[], count: 0 };
      try { economy = validateTypesXml(await fs.readFile(path.join(server.missionPath, "db", "types.xml"), "utf8")); } catch (e) { economy.errors = [(e as Error).message]; }
      const findings = [];
      if (!status.pidAlive) findings.push({ severity: "info", title: "Server process is not running", detail: "Start/Stop tests should run only after Readiness passes." });
      if (!economy.valid) findings.push({ severity: "warn", title: "Economy validation failed", detail: formatValidationSummary(economy) });
      else if (economy.warnings?.length) findings.push({ severity: "warn", title: "Economy validation warnings", detail: formatValidationSummary(economy) });
      if (logs.some((line) => /error|exception|crash|fatal/i.test(line))) findings.push({ severity: "warn", title: "Runtime logs contain error-like lines", detail: logs.filter((line) => /error|exception|crash|fatal/i.test(line)).slice(-10).join("\n") });
      if (backups === 0) findings.push({ severity: "warn", title: "No backups recorded", detail: "Run a manual backup before editing config/economy files." });
      if (!findings.length) findings.push({ severity: "ok", title: "No obvious issue detected", detail: "Doctor/Readiness/Safety tests still remain the source of truth." });
      const answer = { mode: "deterministic-local-analyzer", question: input.question, status, economy, backups, findings };
      writeAudit({ serverId, action: "ai.analyze.local", target: "diagnostics", metadata: { question: input.question, findingCount: findings.length } });
      return answer;
    } catch (error) { return sendError(reply, error); }
  });
}
