import crypto from "node:crypto";
import { API_KEY, AUTH_DISABLED, AUTH_FAILURE_LIMIT_PER_MINUTE, RATE_LIMIT_PER_MINUTE } from "../../shared/env.js";
const rateBuckets = new Map();
const WINDOW_MS = 60_000;
const DEFAULT_BUCKET_TTL_MS = 10 * 60_000;
const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60_000;
function numberEnv(name, fallback) {
    const raw = process.env[name];
    if (!raw)
        return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function boolEnv(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined)
        return fallback;
    return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}
function effectiveApiKey() {
    return process.env.DAYZ_AIO_API_KEY ?? API_KEY;
}
function effectiveAuthDisabled() {
    return boolEnv("DAYZ_AIO_AUTH_DISABLED", AUTH_DISABLED);
}
function effectiveRateLimit() {
    return numberEnv("DAYZ_AIO_RATE_LIMIT_PER_MINUTE", RATE_LIMIT_PER_MINUTE);
}
function effectiveAuthFailureLimit() {
    return numberEnv("DAYZ_AIO_AUTH_FAILURE_LIMIT_PER_MINUTE", AUTH_FAILURE_LIMIT_PER_MINUTE);
}
function bucketTtlMs() {
    return numberEnv("DAYZ_AIO_RATE_LIMIT_BUCKET_TTL_MS", DEFAULT_BUCKET_TTL_MS);
}
function cleanupIntervalMs() {
    return numberEnv("DAYZ_AIO_RATE_LIMIT_CLEANUP_INTERVAL_MS", DEFAULT_CLEANUP_INTERVAL_MS);
}
function clientId(request) {
    return request.ip || request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || "unknown";
}
function getBucket(id) {
    const now = Date.now();
    const current = rateBuckets.get(id);
    if (!current || now - current.windowStart > WINDOW_MS) {
        const next = { windowStart: now, count: 0, authFailures: 0, lastSeen: now };
        rateBuckets.set(id, next);
        return next;
    }
    current.lastSeen = now;
    return current;
}
export function cleanupRateBuckets(now = Date.now()) {
    const ttl = bucketTtlMs();
    let removed = 0;
    for (const [id, bucket] of rateBuckets.entries()) {
        if (now - bucket.lastSeen > ttl) {
            rateBuckets.delete(id);
            removed += 1;
        }
    }
    return { removed, remaining: rateBuckets.size };
}
export function resetRateBucketsForTests() {
    rateBuckets.clear();
}
function extractToken(request) {
    const auth = request.headers.authorization;
    if (auth?.toLowerCase().startsWith("bearer "))
        return auth.slice(7).trim();
    const headerToken = request.headers["x-api-key"];
    if (Array.isArray(headerToken))
        return headerToken[0];
    if (typeof headerToken === "string")
        return headerToken;
    // Browser WebSocket clients cannot set custom headers during the handshake; allow query token for /ws only.
    // Do not expose raw reverse-proxy access logs when using this mode, because query strings can contain the key.
    if (request.url.startsWith("/ws")) {
        try {
            const url = new URL(request.url, "http://localhost");
            return url.searchParams.get("apiKey") ?? undefined;
        }
        catch {
            return undefined;
        }
    }
    return undefined;
}
function tokenMatches(input) {
    const apiKey = effectiveApiKey();
    if (!input || !apiKey)
        return false;
    const a = Buffer.from(input);
    const b = Buffer.from(apiKey);
    if (a.length !== b.length)
        return false;
    return crypto.timingSafeEqual(a, b);
}
function isPublicRoute(request) {
    if (request.method === "OPTIONS")
        return true;
    if (request.url === "/health")
        return true;
    if (request.url === "/favicon.ico")
        return true;
    if (request.url.startsWith("/api/auth/status"))
        return true;
    return false;
}
export async function securityRoutes(app) {
    app.get("/api/auth/status", async () => ({
        authRequired: !effectiveAuthDisabled(),
        header: "X-API-Key",
        bearerSupported: true
    }));
}
export function registerSecurityHooks(app) {
    const cleanupTimer = setInterval(() => {
        const result = cleanupRateBuckets();
        if (result.removed > 0) {
            app.log.debug({ removed: result.removed, remaining: result.remaining }, "Cleaned old rate-limit buckets");
        }
    }, cleanupIntervalMs());
    cleanupTimer.unref?.();
    app.addHook("onClose", async () => {
        clearInterval(cleanupTimer);
        rateBuckets.clear();
    });
    app.addHook("onRequest", async (request, reply) => {
        const id = clientId(request);
        const bucket = getBucket(id);
        bucket.count += 1;
        if (bucket.count > effectiveRateLimit()) {
            return reply.code(429).send({
                error: "Rate limit exceeded",
                retryAfterSeconds: Math.max(0, Math.ceil((bucket.windowStart + WINDOW_MS - Date.now()) / 1000))
            });
        }
        if (effectiveAuthDisabled() || isPublicRoute(request))
            return;
        const token = extractToken(request);
        if (!tokenMatches(token)) {
            bucket.authFailures += 1;
            const status = bucket.authFailures > effectiveAuthFailureLimit() ? 429 : 401;
            return reply.code(status).send({ error: status === 429 ? "Too many authentication failures" : "Missing or invalid API key" });
        }
        request.actor = "api-key";
    });
}
