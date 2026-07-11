import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "../../db/database.js";
import { sendError } from "../../shared/errors.js";
import { assertInsideRoot } from "../../shared/pathGuard.js";
import { writeAudit } from "../audit/service.js";
import { getRuntimeStatus } from "../process/service.js";
import { requireServer } from "../servers/repository.js";
const executeSchema = z.object({
    storageName: z.string().regex(/^storage_\d+$/i).default("storage_1"),
    seasonName: z.string().min(1).max(120).default("New Wipe"),
    confirm: z.literal("WIPE_STORAGE")
});
async function dirExists(dir) { try {
    return (await fs.stat(dir)).isDirectory();
}
catch {
    return false;
} }
function missionRoot(server) {
    if (!server.missionPath)
        throw Object.assign(new Error("Mission path is not configured."), { statusCode: 400 });
    return assertInsideRoot(server.rootPath, server.missionPath);
}
async function listStorages(missionPath) {
    let entries = [];
    try {
        entries = await fs.readdir(missionPath, { withFileTypes: true });
    }
    catch {
        return [];
    }
    const result = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || !/^storage_\d+$/i.test(entry.name))
            continue;
        const full = path.join(missionPath, entry.name);
        const stat = await fs.stat(full);
        result.push({ name: entry.name, path: full, modifiedAt: stat.mtime.toISOString() });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
}
export async function wipeRoutes(app) {
    app.get("/api/servers/:serverId/wipe/plan", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const server = requireServer(serverId);
            const runtime = getRuntimeStatus(serverId);
            const missionPath = missionRoot(server);
            const storages = await listStorages(missionPath);
            const cycles = getDb().prepare("SELECT * FROM wipe_cycles WHERE server_id = ? ORDER BY created_at DESC LIMIT 20").all(serverId);
            return {
                ok: true,
                running: Boolean(runtime.pidAlive),
                missionPath,
                storages,
                cycles,
                warnings: [
                    ...(runtime.pidAlive ? ["Server is running. Stop it before executing a wipe."] : []),
                    ...(!storages.length ? ["No active storage_N folder found."] : [])
                ],
                confirmToken: "WIPE_STORAGE"
            };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/api/servers/:serverId/wipe/execute", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const input = executeSchema.parse(request.body ?? {});
            const server = requireServer(serverId);
            const runtime = getRuntimeStatus(serverId);
            if (runtime.pidAlive)
                return reply.code(400).send({ error: "Stop the DayZ server before executing a wipe." });
            const missionPath = missionRoot(server);
            const source = assertInsideRoot(server.rootPath, path.join(missionPath, input.storageName));
            if (!await dirExists(source))
                return reply.code(404).send({ error: `Storage folder not found: ${source}` });
            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            const archived = assertInsideRoot(server.rootPath, path.join(missionPath, `${input.storageName}_WIPE_${stamp}`));
            await fs.rename(source, archived);
            const id = randomUUID();
            getDb().prepare("INSERT INTO wipe_cycles (id, server_id, name, storage_name, archived_path, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                .run(id, serverId, input.seasonName, input.storageName, archived, new Date().toISOString());
            writeAudit({ serverId, action: "wipe.execute", target: input.storageName, metadata: { archived, seasonName: input.seasonName } });
            return { ok: true, id, archived, message: `${input.storageName} moved out of active mission path. DayZ will recreate storage on next start.` };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
}
