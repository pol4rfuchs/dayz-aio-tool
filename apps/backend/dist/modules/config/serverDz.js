import path from "node:path";
import { z } from "zod";
import { requireServer } from "../servers/repository.js";
import { assertInsideRoot } from "../../shared/pathGuard.js";
import { readTextFile, writeTextFileWithBackup } from "../files/safeWrite.js";
import { writeAudit } from "../audit/service.js";
export const serverDzPayloadSchema = z.object({
    content: z.string().min(1)
});
export function getServerDzPath(serverId) {
    const server = requireServer(serverId);
    const filePath = path.join(server.rootPath, "serverDZ.cfg");
    assertInsideRoot(server.rootPath, filePath);
    return filePath;
}
export async function readServerDz(serverId) {
    return readTextFile(getServerDzPath(serverId));
}
export function validateServerDz(content) {
    const errors = [];
    const required = ["hostname", "maxPlayers"];
    for (const key of required) {
        if (!new RegExp(`\\b${key}\\s*=`, "i").test(content))
            errors.push(`Missing required key: ${key}`);
    }
    if (/passwordAdmin\s*=\s*""/i.test(content))
        errors.push("passwordAdmin is empty.");
    return { valid: errors.length === 0, errors };
}
export async function saveServerDz(serverId, content) {
    const validation = validateServerDz(content);
    if (!validation.valid)
        throw Object.assign(new Error(validation.errors.join(" ")), { statusCode: 400 });
    const filePath = getServerDzPath(serverId);
    await writeTextFileWithBackup({ serverId, filePath, backupType: "config", reason: "serverDZ.cfg save", content });
    writeAudit({ serverId, action: "config.save", target: "serverDZ.cfg", metadata: { bytes: content.length } });
    return { ok: true, validation };
}
