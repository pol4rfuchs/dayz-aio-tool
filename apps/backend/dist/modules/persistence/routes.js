import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { requireServer } from "../servers/repository.js";
import { sendError } from "../../shared/errors.js";
import { assertInsideRoot } from "../../shared/pathGuard.js";
import { writeAudit } from "../audit/service.js";
import { getRuntimeStatus } from "../process/service.js";
const quarantineSchema = z.object({ storageName: z.string().min(1).max(80).default("storage_1") });
const restoreSchema = z.object({ quarantinePath: z.string().min(1) });
async function existsDir(dir) {
    try {
        return (await fs.stat(dir)).isDirectory();
    }
    catch {
        return false;
    }
}
async function dirSize(root, limitFiles = 20000) {
    let files = 0;
    let bytes = 0;
    async function walk(current) {
        if (files >= limitFiles)
            return;
        let entries = [];
        try {
            entries = await fs.readdir(current, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (files >= limitFiles)
                return;
            const full = path.join(current, entry.name);
            try {
                const stat = await fs.lstat(full);
                if (stat.isSymbolicLink())
                    continue;
                if (stat.isDirectory())
                    await walk(full);
                else if (stat.isFile()) {
                    files += 1;
                    bytes += stat.size;
                }
            }
            catch { /* skip */ }
        }
    }
    await walk(root);
    return { files, bytes, truncated: files >= limitFiles };
}
function missionRoot(server) {
    if (!server.missionPath)
        throw Object.assign(new Error("Mission path is not configured."), { statusCode: 400 });
    return assertInsideRoot(server.rootPath, server.missionPath);
}
async function listQuarantines(missionPath) {
    let entries = [];
    try {
        entries = await fs.readdir(missionPath, { withFileTypes: true });
    }
    catch {
        return [];
    }
    const result = [];
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        if (!/^storage_\d+_(?:DISABLED|QUARANTINE)_/i.test(entry.name))
            continue;
        const full = path.join(missionPath, entry.name);
        try {
            const stat = await fs.stat(full);
            result.push({ name: entry.name, path: full, modifiedAt: stat.mtime.toISOString(), ...(await dirSize(full, 2000)) });
        }
        catch { /* skip */ }
    }
    return result.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}
export async function persistenceRoutes(app) {
    app.get("/api/servers/:serverId/persistence/scan", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const server = requireServer(serverId);
            const missionPath = missionRoot(server);
            const candidates = [];
            let entries = [];
            try {
                entries = await fs.readdir(missionPath, { withFileTypes: true });
            }
            catch {
                entries = [];
            }
            for (const entry of entries) {
                if (!entry.isDirectory())
                    continue;
                if (!/^storage_\d+$/i.test(entry.name))
                    continue;
                const full = path.join(missionPath, entry.name);
                const stat = await fs.stat(full);
                candidates.push({ name: entry.name, path: full, modifiedAt: stat.mtime.toISOString(), ...(await dirSize(full)) });
            }
            const quarantines = await listQuarantines(missionPath);
            const status = getRuntimeStatus(serverId);
            const warnings = [];
            if (status.pidAlive)
                warnings.push("Server appears to be running. Stop it before quarantine/restore actions.");
            if (!candidates.length)
                warnings.push("No storage_N folder found in mission path.");
            writeAudit({ serverId, action: "persistence.scan", target: missionPath, metadata: { candidates: candidates.length, quarantines: quarantines.length } });
            return { ok: true, missionPath, running: Boolean(status.pidAlive), candidates, quarantines, warnings };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/api/servers/:serverId/persistence/quarantine", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const input = quarantineSchema.parse(request.body ?? {});
            const server = requireServer(serverId);
            const status = getRuntimeStatus(serverId);
            if (status.pidAlive)
                return reply.code(400).send({ error: "Stop the DayZ server before quarantining persistence storage." });
            const missionPath = missionRoot(server);
            const source = assertInsideRoot(server.rootPath, path.join(missionPath, input.storageName));
            if (!await existsDir(source))
                return reply.code(404).send({ error: `Storage folder not found: ${source}` });
            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            const backupCopy = assertInsideRoot(server.rootPath, path.join(missionPath, `${input.storageName}_QUARANTINE_COPY_${stamp}`));
            const disabled = assertInsideRoot(server.rootPath, path.join(missionPath, `${input.storageName}_DISABLED_${stamp}`));
            await fs.cp(source, backupCopy, { recursive: true, force: false });
            await fs.rename(source, disabled);
            writeAudit({ serverId, action: "persistence.quarantine", target: input.storageName, metadata: { source, backupCopy, disabled } });
            return { ok: true, source, backupCopy, disabled, message: `${input.storageName} was copied and renamed out of the active mission path.` };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/api/servers/:serverId/persistence/restore", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const input = restoreSchema.parse(request.body);
            const server = requireServer(serverId);
            const status = getRuntimeStatus(serverId);
            if (status.pidAlive)
                return reply.code(400).send({ error: "Stop the DayZ server before restoring persistence storage." });
            const missionPath = missionRoot(server);
            const quarantinePath = assertInsideRoot(server.rootPath, input.quarantinePath);
            if (!await existsDir(quarantinePath))
                return reply.code(404).send({ error: `Quarantine folder not found: ${quarantinePath}` });
            const restoreNameMatch = path.basename(quarantinePath).match(/^(storage_\d+)/i);
            const restoreName = restoreNameMatch?.[1] ?? "storage_1";
            const active = assertInsideRoot(server.rootPath, path.join(missionPath, restoreName));
            if (await existsDir(active))
                return reply.code(409).send({ error: `Active storage folder already exists: ${active}. Quarantine it first.` });
            await fs.cp(quarantinePath, active, { recursive: true, force: false });
            writeAudit({ serverId, action: "persistence.restore", target: restoreName, metadata: { quarantinePath, active } });
            return { ok: true, restored: active, source: quarantinePath };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
}
