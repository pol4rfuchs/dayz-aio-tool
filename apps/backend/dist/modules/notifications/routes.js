import crypto from "node:crypto";
import { z } from "zod";
import { getDb } from "../../db/database.js";
import { sendError } from "../../shared/errors.js";
import { writeAudit } from "../audit/service.js";
const targetSchema = z.object({
    name: z.string().min(1),
    type: z.enum(["ntfy", "webhook"]),
    url: z.string().url(),
    topic: z.string().optional().nullable(),
    enabled: z.boolean().default(true)
});
async function postNotification(target, message, title = "DayZ AIO") {
    if (target.type === "ntfy") {
        const url = target.topic ? `${String(target.url).replace(/\/$/, "")}/${target.topic}` : target.url;
        const res = await fetch(url, { method: "POST", headers: { title }, body: message });
        return { ok: res.ok, status: res.status, text: await res.text().catch(() => "") };
    }
    const res = await fetch(target.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, message }) });
    return { ok: res.ok, status: res.status, text: await res.text().catch(() => "") };
}
export async function notifyAll(message, title) {
    const targets = getDb().prepare("SELECT id, name, type, url, topic FROM notification_targets WHERE enabled = 1").all();
    const results = [];
    for (const target of targets) {
        try {
            results.push({ target: target.name, ...(await postNotification(target, message, title)) });
        }
        catch (error) {
            results.push({ target: target.name, ok: false, error: String(error) });
        }
    }
    return results;
}
export async function notificationRoutes(app) {
    app.get("/api/notifications", async () => ({ items: getDb().prepare("SELECT id, name, type, url, topic, enabled, created_at as createdAt, updated_at as updatedAt FROM notification_targets ORDER BY created_at DESC").all() }));
    app.post("/api/notifications", async (request, reply) => {
        try {
            const input = targetSchema.parse(request.body);
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            getDb().prepare("INSERT INTO notification_targets (id, name, type, url, topic, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                .run(id, input.name, input.type, input.url, input.topic ?? null, input.enabled ? 1 : 0, now, now);
            writeAudit({ action: "notification.create", target: input.name, metadata: { ...input, url: "***" } });
            return { id, ...input, createdAt: now, updatedAt: now };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/api/notifications/:id/test", async (request, reply) => {
        try {
            const { id } = request.params;
            const target = getDb().prepare("SELECT id, name, type, url, topic FROM notification_targets WHERE id = ?").get(id);
            if (!target)
                return reply.code(404).send({ error: "Notification target not found" });
            const result = await postNotification(target, "Test notification from DayZ AIO", "DayZ AIO Test");
            writeAudit({ action: "notification.test", target: target.name, metadata: result });
            return result;
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/api/notifications/test-all", async () => ({ results: await notifyAll("Test notification from DayZ AIO", "DayZ AIO Test") }));
    app.delete("/api/notifications/:id", async (request) => {
        const { id } = request.params;
        getDb().prepare("DELETE FROM notification_targets WHERE id = ?").run(id);
        return { ok: true };
    });
}
