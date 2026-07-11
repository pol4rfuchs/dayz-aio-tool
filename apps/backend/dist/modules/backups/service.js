import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { BACKUP_DIR } from "../../shared/env.js";
import { getDb } from "../../db/database.js";
import { requireServer } from "../servers/repository.js";
import { assertInsideRoot } from "../../shared/pathGuard.js";
import { writeAudit } from "../audit/service.js";
import { broadcast } from "../realtime/hub.js";
export async function createBackup(input) {
    const server = requireServer(input.serverId);
    const now = new Date().toISOString();
    const stamp = now.replaceAll(":", "-").replaceAll(".", "-");
    const id = crypto.randomUUID();
    const backupPath = path.join(BACKUP_DIR, input.serverId, `${stamp}_${input.type}_${id}`);
    await fs.mkdir(backupPath, { recursive: true });
    const copiedFiles = [];
    const skippedFiles = [];
    for (const source of input.files.filter(Boolean)) {
        const sourcePath = assertInsideRoot(server.rootPath, source);
        try {
            const stat = await fs.stat(sourcePath);
            if (!stat.isFile()) {
                skippedFiles.push(sourcePath);
                continue;
            }
            const relative = path.relative(server.rootPath, sourcePath);
            const target = path.join(backupPath, "files", relative);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.copyFile(sourcePath, target);
            copiedFiles.push({ sourcePath, backupFile: path.join("files", relative) });
        }
        catch {
            skippedFiles.push(sourcePath);
        }
    }
    if (copiedFiles.length === 0) {
        throw Object.assign(new Error("No existing files found for backup."), { statusCode: 404 });
    }
    const metadata = {
        id,
        serverId: input.serverId,
        type: input.type,
        reason: input.reason,
        files: copiedFiles,
        skippedFiles,
        createdAt: now
    };
    await fs.writeFile(path.join(backupPath, "metadata.json"), JSON.stringify(metadata, null, 2));
    getDb().prepare("INSERT INTO backups (id, server_id, type, path, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, input.serverId, input.type, backupPath, input.reason, now);
    writeAudit({ serverId: input.serverId, action: "backup.create", target: input.type, metadata });
    broadcast("backup.create", metadata, input.serverId);
    return { ...metadata, path: backupPath };
}
export async function createManualBackup(serverId) {
    const server = requireServer(serverId);
    const candidates = [
        path.join(server.rootPath, "serverDZ.cfg"),
        server.missionPath ? path.join(server.missionPath, "db", "types.xml") : "",
        server.missionPath ? path.join(server.missionPath, "db", "events.xml") : "",
        server.missionPath ? path.join(server.missionPath, "db", "globals.xml") : "",
        server.missionPath ? path.join(server.missionPath, "cfgspawnabletypes.xml") : ""
    ].filter(Boolean);
    return createBackup({ serverId, type: "manual", reason: "manual backup", files: candidates });
}
export function listBackups(serverId) {
    requireServer(serverId);
    return getDb().prepare(`
    SELECT id, server_id as serverId, type, path, reason, created_at as createdAt
    FROM backups WHERE server_id = ? ORDER BY created_at DESC
  `).all(serverId);
}
export async function readBackupMetadata(serverId, backupId) {
    requireServer(serverId);
    const row = getDb().prepare("SELECT id, path FROM backups WHERE server_id = ? AND id = ?").get(serverId, backupId);
    if (!row)
        throw Object.assign(new Error("Backup not found"), { statusCode: 404 });
    return JSON.parse(await fs.readFile(path.join(row.path, "metadata.json"), "utf8"));
}
export async function restoreBackup(serverId, backupId) {
    const server = requireServer(serverId);
    const row = getDb().prepare("SELECT id, path FROM backups WHERE server_id = ? AND id = ?").get(serverId, backupId);
    if (!row)
        throw Object.assign(new Error("Backup not found"), { statusCode: 404 });
    const metadata = JSON.parse(await fs.readFile(path.join(row.path, "metadata.json"), "utf8"));
    for (const file of metadata.files) {
        const sourcePath = assertInsideRoot(server.rootPath, file.sourcePath);
        const backupFile = path.join(row.path, file.backupFile);
        await fs.mkdir(path.dirname(sourcePath), { recursive: true });
        await fs.copyFile(backupFile, sourcePath);
    }
    writeAudit({ serverId, action: "backup.restore", target: backupId, metadata });
    broadcast("backup.restore", { backupId, restored: metadata.files.length }, serverId);
    return { ok: true, restored: metadata.files.length };
}
export function deleteBackup(serverId, backupId) {
    requireServer(serverId);
    const row = getDb().prepare("SELECT id, path FROM backups WHERE server_id = ? AND id = ?").get(serverId, backupId);
    if (!row)
        throw Object.assign(new Error("Backup not found"), { statusCode: 404 });
    getDb().prepare("DELETE FROM backups WHERE id = ?").run(backupId);
    fs.rm(row.path, { recursive: true, force: true }).catch(() => undefined);
    writeAudit({ serverId, action: "backup.delete", target: backupId });
    return { ok: true };
}
