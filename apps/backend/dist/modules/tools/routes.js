import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { sendError } from "../../shared/errors.js";
import { STEAM_WEB_API_KEY } from "../../shared/env.js";
import { assertInsideRoot } from "../../shared/pathGuard.js";
import { parseTypesXml } from "../economy/parser.js";
import { requireServer } from "../servers/repository.js";
const dayNightSchema = z.object({
    fullCycleMinutes: z.number().min(10).max(1440).default(240),
    nightSpeedMultiplier: z.number().min(0.1).max(64).default(1),
    serverTimePersistent: z.boolean().default(true)
});
function round2(value) { return Math.round(value * 100) / 100; }
function calculateDayNight(input) {
    const serverTimeAcceleration = round2(1440 / input.fullCycleMinutes);
    const nightTimeAcceleration = round2(input.nightSpeedMultiplier);
    return {
        input,
        serverTimeAcceleration,
        serverNightTimeAcceleration: nightTimeAcceleration,
        estimatedFullCycleMinutes: round2(1440 / serverTimeAcceleration),
        cfg: {
            serverTimeAcceleration,
            serverNightTimeAcceleration: nightTimeAcceleration,
            serverTimePersistent: input.serverTimePersistent ? 1 : 0
        },
        notes: [
            "Formula: serverTimeAcceleration = 1440 / desired full real-time cycle minutes.",
            "serverNightTimeAcceleration is a relative multiplier for night speed. Validate in-game before production use."
        ]
    };
}
async function collectClassnames(serverId, query, limit) {
    const server = requireServer(serverId);
    if (!server.missionPath)
        throw Object.assign(new Error("Mission path is not configured."), { statusCode: 400 });
    const files = [
        path.join(server.missionPath, "db", "types.xml"),
        path.join(server.missionPath, "cfgspawnabletypes.xml")
    ].map((file) => assertInsideRoot(server.rootPath, file));
    const seen = new Map();
    for (const file of files) {
        let xml = "";
        try {
            xml = await fs.readFile(file, "utf8");
        }
        catch {
            continue;
        }
        if (path.basename(file).toLowerCase() === "types.xml") {
            for (const item of parseTypesXml(xml)) {
                if (!seen.has(item.name))
                    seen.set(item.name, { classname: item.name, source: "types.xml", nominal: item.nominal, min: item.min, category: item.category });
            }
        }
        else {
            for (const match of xml.matchAll(/<type\s+name="([^"]+)"/gi)) {
                const name = match[1];
                if (!seen.has(name))
                    seen.set(name, { classname: name, source: "cfgspawnabletypes.xml" });
            }
        }
    }
    const needle = query.trim().toLowerCase();
    return [...seen.values()]
        .filter((item) => !needle || item.classname.toLowerCase().includes(needle) || item.category?.toLowerCase().includes(needle))
        .sort((a, b) => a.classname.localeCompare(b.classname))
        .slice(0, limit);
}
const steamIdsSchema = z.object({ steamIds: z.array(z.string().regex(/^\d{17}$/)).min(1).max(100) });
export async function toolRoutes(app) {
    app.post("/api/tools/day-night/calculate", async (request) => {
        const input = dayNightSchema.parse(request.body ?? {});
        return calculateDayNight(input);
    });
    app.get("/api/servers/:serverId/economy/classnames", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const query = String(request.query.query ?? "");
            const limit = Math.min(Number(request.query.limit ?? 50), 250);
            return { ok: true, query, items: await collectClassnames(serverId, query, limit) };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/api/tools/steam/ban-check", async (request, reply) => {
        try {
            const input = steamIdsSchema.parse(request.body ?? {});
            if (!STEAM_WEB_API_KEY) {
                return { ok: false, configured: false, error: "STEAM_WEB_API_KEY is not configured. VAC/Steam-ban check is disabled." };
            }
            const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/");
            url.searchParams.set("key", STEAM_WEB_API_KEY);
            url.searchParams.set("steamids", input.steamIds.join(","));
            const response = await fetch(url, { method: "GET" });
            if (!response.ok)
                return reply.code(response.status).send({ ok: false, configured: true, error: `Steam API returned ${response.status}` });
            const payload = await response.json();
            return { ok: true, configured: true, players: payload.players ?? [] };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
}
