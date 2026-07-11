import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { assertInsideRoot } from "../../shared/pathGuard.js";
import { writeTextFileWithBackup } from "../files/safeWrite.js";
import {
  parseEventsXml,
  parseGlobalsXml,
  parseSpawnableTypesSummary,
  parseTypesXml,
  updateEventsXmlFromItems,
  updateGlobalsXmlFromItems,
  updateTypesXmlFromItems,
  validateEconomyXml,
  validateTypesXml, assertEconomyXmlSize,
  type DayzEventItem,
  type DayzGlobalItem,
  type DayzTypeItem
} from "./parser.js";
import { requireServer } from "../servers/repository.js";
import { sendError } from "../../shared/errors.js";
import { writeAudit } from "../audit/service.js";
import { lineDiff } from "../diff/service.js";

const saveXmlSchema = z.object({
  xml: z.string().min(1).refine((value) => {
    try { assertEconomyXmlSize(value, "submitted economy XML"); return true; }
    catch { return false; }
  }, "Submitted economy XML exceeds DAYZ_AIO_ECONOMY_XML_MAX_BYTES")
});
const saveTypesItemsSchema = z.object({ items: z.array(z.any()) });
const saveEventsItemsSchema = z.object({ items: z.array(z.any()) });
const saveGlobalsItemsSchema = z.object({ items: z.array(z.any()) });

const ECONOMY_FILES = new Set([
  "types.xml",
  "events.xml",
  "globals.xml",
  "messages.xml",
  "cfgspawnabletypes.xml",
  "cfgeventspawns.xml",
  "cfgrandompresets.xml"
]);

function getMissionPath(serverId: string) {
  const server = requireServer(serverId);
  return server.missionPath || path.join(server.rootPath, "mpmissions", "dayzOffline.chernarusplus");
}

function getEconomyPath(serverId: string, file = "types.xml") {
  if (!ECONOMY_FILES.has(file)) throw Object.assign(new Error(`Unsupported economy file: ${file}`), { statusCode: 400 });
  const server = requireServer(serverId);
  const missionPath = getMissionPath(serverId);
  const inDb = ["types.xml", "events.xml", "globals.xml", "messages.xml"].includes(file);
  const filePath = inDb ? path.join(missionPath, "db", file) : path.join(missionPath, file);
  return assertInsideRoot(server.rootPath, filePath);
}

function parseByFile(file: string, xml: string) {
  if (file === "types.xml") return { items: parseTypesXml(xml) };
  if (file === "events.xml") return { events: parseEventsXml(xml) };
  if (file === "globals.xml") return { globals: parseGlobalsXml(xml) };
  if (file === "cfgspawnabletypes.xml") return { spawnable: parseSpawnableTypesSummary(xml) };
  return {};
}

export async function economyRoutes(app: FastifyInstance) {
  app.get("/files", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const files = [];
      for (const file of ECONOMY_FILES) {
        const filePath = getEconomyPath(serverId, file);
        try {
          const stat = await fs.stat(filePath);
          files.push({ file, path: filePath, exists: true, size: stat.size });
        } catch {
          files.push({ file, path: filePath, exists: false, size: 0 });
        }
      }
      return { files };
    } catch (error) { return sendError(reply, error); }
  });

  app.get("/types", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const filePath = getEconomyPath(serverId, "types.xml");
      const xml = await fs.readFile(filePath, "utf8");
      return { path: filePath, file: "types.xml", xml, items: parseTypesXml(xml), validation: validateTypesXml(xml) };
    } catch (error) { return sendError(reply, error); }
  });

  app.put("/types/items", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const input = saveTypesItemsSchema.parse(request.body) as { items: DayzTypeItem[] };
      const filePath = getEconomyPath(serverId, "types.xml");
      const currentXml = await fs.readFile(filePath, "utf8");
      const nextXml = updateTypesXmlFromItems(currentXml, input.items);
      const validation = validateTypesXml(nextXml);
      if (!validation.valid) return reply.code(400).send(validation);
      await writeTextFileWithBackup({ serverId, filePath, backupType: "economy", reason: "types.xml table save", content: nextXml });
      writeAudit({ serverId, action: "economy.types.table_save", target: "types.xml", metadata: validation });
      return { ok: true, xml: nextXml, validation };
    } catch (error) { return sendError(reply, error); }
  });

  app.put("/events/items", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const input = saveEventsItemsSchema.parse(request.body) as { items: DayzEventItem[] };
      const filePath = getEconomyPath(serverId, "events.xml");
      const currentXml = await fs.readFile(filePath, "utf8");
      const nextXml = updateEventsXmlFromItems(currentXml, input.items);
      const validation = validateEconomyXml("events.xml", nextXml);
      if (!validation.valid) return reply.code(400).send(validation);
      await writeTextFileWithBackup({ serverId, filePath, backupType: "economy", reason: "events.xml table save", content: nextXml });
      writeAudit({ serverId, action: "economy.events.table_save", target: "events.xml", metadata: validation });
      return { ok: true, xml: nextXml, validation };
    } catch (error) { return sendError(reply, error); }
  });

  app.put("/globals/items", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const input = saveGlobalsItemsSchema.parse(request.body) as { items: DayzGlobalItem[] };
      const filePath = getEconomyPath(serverId, "globals.xml");
      const currentXml = await fs.readFile(filePath, "utf8");
      const nextXml = updateGlobalsXmlFromItems(currentXml, input.items);
      const validation = validateEconomyXml("globals.xml", nextXml);
      if (!validation.valid) return reply.code(400).send(validation);
      await writeTextFileWithBackup({ serverId, filePath, backupType: "economy", reason: "globals.xml table save", content: nextXml });
      writeAudit({ serverId, action: "economy.globals.table_save", target: "globals.xml", metadata: validation });
      return { ok: true, xml: nextXml, validation };
    } catch (error) { return sendError(reply, error); }
  });

  app.get("/:file", async (request, reply) => {
    try {
      const { serverId, file } = request.params as { serverId: string; file: string };
      const filePath = getEconomyPath(serverId, file);
      const xml = await fs.readFile(filePath, "utf8");
      return { path: filePath, file, xml, ...parseByFile(file, xml), validation: validateEconomyXml(file, xml) };
    } catch (error) { return sendError(reply, error); }
  });

  app.post("/:file/validate", async (request) => {
    const { file } = request.params as { file: string };
    const input = saveXmlSchema.parse(request.body);
    return validateEconomyXml(file, input.xml);
  });

  app.post("/:file/diff", async (request, reply) => {
    try {
      const { serverId, file } = request.params as { serverId: string; file: string };
      const input = saveXmlSchema.parse(request.body);
      const oldXml = await fs.readFile(getEconomyPath(serverId, file), "utf8");
      return { diff: lineDiff(oldXml, input.xml) };
    } catch (error) { return sendError(reply, error); }
  });

  app.put("/:file", async (request, reply) => {
    try {
      const { serverId, file } = request.params as { serverId: string; file: string };
      const input = saveXmlSchema.parse(request.body);
      const validation = validateEconomyXml(file, input.xml);
      if (!validation.valid) return reply.code(400).send(validation);
      const filePath = getEconomyPath(serverId, file);
      await writeTextFileWithBackup({ serverId, filePath, backupType: "economy", reason: `${file} save`, content: input.xml });
      writeAudit({ serverId, action: "economy.save", target: file, metadata: validation });
      return { ok: true, validation };
    } catch (error) { return sendError(reply, error); }
  });
}
