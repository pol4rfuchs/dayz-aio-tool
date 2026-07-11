import fs from "node:fs/promises";
import path from "node:path";
import { sendError } from "../../shared/errors.js";
import { requireServer } from "../servers/repository.js";
import { listBackups } from "../backups/service.js";
import { getRuntimeStatus } from "../process/service.js";
import { parseTypesXml } from "../economy/parser.js";
async function dirSize(root, maxFiles = 2000) {
    let size = 0;
    let files = 0;
    async function walk(current) {
        if (files >= maxFiles)
            return;
        let entries = [];
        try {
            entries = await fs.readdir(current, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (files >= maxFiles)
                return;
            const p = path.join(current, entry.name);
            if (entry.isDirectory())
                await walk(p);
            else if (entry.isFile()) {
                files++;
                try {
                    size += (await fs.stat(p)).size;
                }
                catch { /* noop */ }
            }
        }
    }
    await walk(root);
    return { size, files, truncated: files >= maxFiles };
}
export async function analyticsRoutes(app) {
    app.get("/api/servers/:serverId/analytics/summary", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const server = requireServer(serverId);
            const status = getRuntimeStatus(serverId);
            const backups = listBackups(serverId).slice(0, 10);
            const mods = await fs.readdir(server.rootPath, { withFileTypes: true }).then((entries) => entries.filter((e) => e.isDirectory() && e.name.startsWith("@")).length).catch(() => 0);
            const missionDb = server.missionPath ? path.join(server.missionPath, "db") : "";
            const dbSize = missionDb ? await dirSize(missionDb) : { size: 0, files: 0, truncated: false };
            let economy = { items: 0, weapons: 0, food: 0 };
            try {
                const xml = await fs.readFile(path.join(server.missionPath, "db", "types.xml"), "utf8");
                const items = parseTypesXml(xml);
                economy = {
                    items: items.length,
                    weapons: items.filter((i) => /weapon|rifle|pistol|ak|m4|mosin|sks/i.test(`${i.name} ${i.category ?? ""}`)).length,
                    food: items.filter((i) => /food|can|meat|fruit|drink/i.test(`${i.name} ${i.category ?? ""}`)).length
                };
            }
            catch { /* optional */ }
            return { server: { id: server.id, name: server.name }, status, backups, mods, dbSize, economy };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
}
