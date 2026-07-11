import crypto from "node:crypto";
import { z } from "zod";
import { getDb } from "../../db/database.js";
import { sendError } from "../../shared/errors.js";
import { requireServer } from "../servers/repository.js";
import { restartServer, startServer, stopServer } from "../process/service.js";
import { createManualBackup } from "../backups/service.js";
import { writeAudit } from "../audit/service.js";
import { broadcast } from "../realtime/hub.js";
import { notifyAll } from "../notifications/routes.js";
import { SCHEDULE_ESCALATE_AFTER_FAILURES, SCHEDULE_MAX_RETRIES, SCHEDULE_RETRY_DELAY_MINUTES } from "../../shared/env.js";
const scheduleSchema = z.object({
    serverId: z.string().min(1),
    name: z.string().min(1),
    action: z.enum(["start", "stop", "restart", "backup"]),
    enabled: z.boolean().default(true),
    intervalMinutes: z.number().int().positive().optional().nullable(),
    atTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable()
});
function computeNextRun(input, from = new Date()) {
    if (input.intervalMinutes)
        return new Date(from.getTime() + input.intervalMinutes * 60_000).toISOString();
    if (input.atTime) {
        const [h, m] = input.atTime.split(":").map(Number);
        const next = new Date(from);
        next.setHours(h, m, 0, 0);
        if (next <= from)
            next.setDate(next.getDate() + 1);
        return next.toISOString();
    }
    return null;
}
export async function runScheduleAction(serverId, action) {
    if (action === "start")
        return startServer(serverId);
    if (action === "stop")
        return stopServer(serverId);
    if (action === "restart")
        return restartServer(serverId);
    if (action === "backup")
        return createManualBackup(serverId);
    throw new Error(`Unsupported schedule action: ${action}`);
}
let scheduleTickRunning = false;
export async function tickSchedules() {
    if (scheduleTickRunning)
        return 0;
    scheduleTickRunning = true;
    try {
        const now = new Date();
        const due = getDb().prepare(`
      SELECT id, server_id as serverId, name, action, interval_minutes as intervalMinutes, at_time as atTime
      FROM schedules WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?
    `).all(now.toISOString());
        for (const item of due) {
            try {
                const result = await runScheduleAction(item.serverId, item.action);
                const nextRun = computeNextRun(item, new Date());
                getDb().prepare("UPDATE schedules SET last_run_at = ?, next_run_at = ?, failure_count = 0, last_error = NULL, updated_at = ? WHERE id = ?")
                    .run(new Date().toISOString(), nextRun, new Date().toISOString(), item.id);
                writeAudit({ serverId: item.serverId, action: "schedule.run", target: item.name, metadata: { result } });
                broadcast("schedule.run", { ...item, result, nextRun }, item.serverId);
            }
            catch (error) {
                const message = String(error instanceof Error ? error.message : error);
                const updated = getDb().prepare(`
          UPDATE schedules
          SET failure_count = failure_count + 1,
              last_error = ?,
              updated_at = ?
          WHERE id = ?
          RETURNING failure_count as failureCount
        `).get(message, new Date().toISOString(), item.id);
                const failureCount = updated?.failureCount ?? 1;
                const retryAllowed = failureCount <= SCHEDULE_MAX_RETRIES;
                const retryAt = retryAllowed ? new Date(Date.now() + SCHEDULE_RETRY_DELAY_MINUTES * 60_000).toISOString() : computeNextRun(item, new Date());
                getDb().prepare("UPDATE schedules SET next_run_at = ?, updated_at = ? WHERE id = ?").run(retryAt, new Date().toISOString(), item.id);
                const escalated = failureCount >= SCHEDULE_ESCALATE_AFTER_FAILURES;
                writeAudit({ serverId: item.serverId, action: retryAllowed ? "schedule.failed.retry_scheduled" : "schedule.failed", target: item.name, metadata: { error: message, failureCount, retryAllowed, retryAt, escalated } });
                broadcast("schedule.failed", { ...item, error: message, failureCount, retryAllowed, retryAt, escalated }, item.serverId);
                const title = escalated ? "DayZ AIO Scheduler ESCALATION" : "DayZ AIO Scheduler Failure";
                const retryLine = retryAllowed ? `\nRetry: ${retryAt}` : `\nNext scheduled run: ${retryAt ?? "disabled"}`;
                const notifications = await notifyAll(`Scheduled action failed: ${item.name} (${item.action})
Server: ${item.serverId}
Failure count: ${failureCount}${retryLine}
Error: ${message}`, title);
                writeAudit({ serverId: item.serverId, action: escalated ? "schedule.failure.escalate" : "schedule.failure.notify", target: item.name, metadata: { notifications, failureCount, retryAllowed, retryAt } });
            }
        }
        return due.length;
    }
    finally {
        scheduleTickRunning = false;
    }
}
export async function schedulerRoutes(app) {
    app.get("/api/schedules", async (request) => {
        const query = request.query;
        const rows = query.serverId
            ? getDb().prepare("SELECT id, server_id as serverId, name, action, enabled, interval_minutes as intervalMinutes, at_time as atTime, last_run_at as lastRunAt, next_run_at as nextRunAt, failure_count as failureCount, last_error as lastError, created_at as createdAt, updated_at as updatedAt FROM schedules WHERE server_id = ? ORDER BY created_at DESC").all(query.serverId)
            : getDb().prepare("SELECT id, server_id as serverId, name, action, enabled, interval_minutes as intervalMinutes, at_time as atTime, last_run_at as lastRunAt, next_run_at as nextRunAt, failure_count as failureCount, last_error as lastError, created_at as createdAt, updated_at as updatedAt FROM schedules ORDER BY created_at DESC").all();
        return { items: rows };
    });
    app.post("/api/schedules", async (request, reply) => {
        try {
            const input = scheduleSchema.parse(request.body);
            requireServer(input.serverId);
            if (!input.intervalMinutes && !input.atTime)
                return reply.code(400).send({ error: "intervalMinutes or atTime is required" });
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            const nextRun = input.enabled ? computeNextRun(input) : null;
            getDb().prepare(`
        INSERT INTO schedules (id, server_id, name, action, enabled, interval_minutes, at_time, next_run_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, input.serverId, input.name, input.action, input.enabled ? 1 : 0, input.intervalMinutes ?? null, input.atTime ?? null, nextRun, now, now);
            writeAudit({ serverId: input.serverId, action: "schedule.create", target: input.name, metadata: input });
            return { id, ...input, nextRunAt: nextRun, createdAt: now, updatedAt: now };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/api/schedules/:id/run", async (request, reply) => {
        try {
            const { id } = request.params;
            const row = getDb().prepare("SELECT server_id as serverId, action, name FROM schedules WHERE id = ?").get(id);
            if (!row)
                return reply.code(404).send({ error: "Schedule not found" });
            return await runScheduleAction(row.serverId, row.action);
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.delete("/api/schedules/:id", async (request) => {
        const { id } = request.params;
        getDb().prepare("DELETE FROM schedules WHERE id = ?").run(id);
        return { ok: true };
    });
}
