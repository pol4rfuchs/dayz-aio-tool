import crypto from "node:crypto";
import { getDb } from "../../db/database.js";
import { broadcast } from "../realtime/hub.js";
export function writeAudit(input) {
    const row = {
        id: crypto.randomUUID(),
        serverId: input.serverId ?? null,
        actor: input.actor ?? "system",
        action: input.action,
        target: input.target,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        createdAt: new Date().toISOString()
    };
    getDb().prepare(`
    INSERT INTO audit_log (id, server_id, actor, action, target, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(row.id, row.serverId, row.actor, row.action, row.target, row.metadata, row.createdAt);
    broadcast("audit.write", row, row.serverId ?? undefined);
    return row;
}
export function listAudit(serverId, limit = 100) {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    const sql = `
    SELECT id, server_id as serverId, actor, action, target, metadata, created_at as createdAt
    FROM audit_log
    ${serverId ? "WHERE server_id = ?" : ""}
    ORDER BY created_at DESC
    LIMIT ?
  `;
    const rows = serverId
        ? getDb().prepare(sql).all(serverId, safeLimit)
        : getDb().prepare(sql).all(safeLimit);
    return rows.map((row) => ({ ...row, metadata: row.metadata ? JSON.parse(row.metadata) : null }));
}
