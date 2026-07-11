import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { sendError } from "../../shared/errors.js";
import { assertInsideRoot } from "../../shared/pathGuard.js";
import { writeTextFileWithBackup } from "../files/safeWrite.js";
import { requireServer } from "../servers/repository.js";
import { writeAudit } from "../audit/service.js";
import { findDzsaCandidates } from "../servers/dzsaDetection.js";
async function pathExists(candidate) {
    try {
        await fs.access(candidate);
        return true;
    }
    catch {
        return false;
    }
}
function escapeXml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
const messageItemSchema = z.object({
    text: z.string().min(1).max(300),
    deadline: z.number().int().min(0).max(1440).default(15),
    shutdown: z.boolean().default(false)
});
const messagesSchema = z.object({
    items: z.array(messageItemSchema).min(1).max(50),
    save: z.boolean().default(false)
});
function buildMessagesXml(items) {
    const body = items.map((item) => [
        "    <message>",
        `        <deadline>${item.deadline}</deadline>`,
        `        <shutdown>${item.shutdown ? 1 : 0}</shutdown>`,
        `        <text>${escapeXml(item.text)}</text>`,
        "    </message>"
    ].join("\n")).join("\n");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<messages>\n${body}\n</messages>\n`;
}
export async function communityRoutes(app) {
    app.get("/api/servers/:serverId/community/dzsa-check", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const server = requireServer(serverId);
            const root = assertInsideRoot(server.rootPath, server.rootPath);
            const found = await findDzsaCandidates(root);
            const installed = found.length > 0;
            const result = {
                ok: true,
                installed,
                status: installed ? "pass" : "warn",
                rootPath: root,
                found,
                recommendation: installed
                    ? "DZSALModServer candidate detected. Verify that the launcher server package is configured for your public server listing."
                    : "DZSALModServer was not detected in the server root. DZSA Launcher auto-mod sync may not work until it is installed/configured."
            };
            writeAudit({ serverId, action: "community.dzsa_check", target: root, metadata: result });
            return result;
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/api/servers/:serverId/community/messages", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const input = messagesSchema.parse(request.body ?? {});
            const server = requireServer(serverId);
            if (!server.missionPath)
                throw Object.assign(new Error("Mission path is not configured."), { statusCode: 400 });
            const xml = buildMessagesXml(input.items);
            const filePath = assertInsideRoot(server.rootPath, path.join(server.missionPath, "db", "messages.xml"));
            const exists = await pathExists(filePath);
            if (input.save) {
                await writeTextFileWithBackup({ serverId, filePath, backupType: "economy", reason: "messages.xml generated", content: xml });
                writeAudit({ serverId, action: "community.messages.save", target: filePath, metadata: { count: input.items.length } });
            }
            else {
                writeAudit({ serverId, action: "community.messages.preview", target: filePath, metadata: { count: input.items.length } });
            }
            return { ok: true, saved: input.save, existsBefore: exists, path: filePath, xml };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
}
