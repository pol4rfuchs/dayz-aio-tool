import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { BACKEND_LOG_FILE, BACKEND_LOG_MAX_FILES, BACKEND_LOG_MAX_SIZE_BYTES, LOG_DIR, SNAPSHOT_DIR } from "./env.js";

function ensureDirSync(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function ensureRuntimeLogDirsSync() {
  ensureDirSync(LOG_DIR);
  ensureDirSync(SNAPSHOT_DIR);
  ensureDirSync(path.dirname(BACKEND_LOG_FILE));
}

export function rotateFileIfNeededSync(filePath: string, maxBytes: number, maxFiles: number) {
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.size < maxBytes) return;

    for (let index = maxFiles - 1; index >= 1; index -= 1) {
      const from = `${filePath}.${index}`;
      const to = `${filePath}.${index + 1}`;
      if (fs.existsSync(to)) fs.rmSync(to, { force: true });
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }

    const first = `${filePath}.1`;
    if (fs.existsSync(first)) fs.rmSync(first, { force: true });
    fs.renameSync(filePath, first);
  } catch {
    // Logging must never block backend startup.
  }
}

const LOG_FLUSH_INTERVAL_MS = 250;
let pendingLines: string[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let flushing = false;

function sanitizeForBackendLog(value: string) {
  return value
    .replace(/([?&]apiKey=)[^&\s]+/gi, "$1***")
    .replace(/(authorization:\s*bearer\s+)[^\s,}]+/gi, "$1***")
    .replace(/(x-api-key["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, "$1***");
}

async function flushBackendLogs() {
  if (flushing || pendingLines.length === 0) return;
  flushing = true;
  const lines = pendingLines.join("");
  pendingLines = [];
  try {
    await fs.promises.mkdir(path.dirname(BACKEND_LOG_FILE), { recursive: true });
    await fs.promises.appendFile(BACKEND_LOG_FILE, lines, "utf8");
  } catch {
    // File logging must never break API handling.
  } finally {
    flushing = false;
    if (pendingLines.length > 0) scheduleFlush();
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushBackendLogs();
  }, LOG_FLUSH_INTERVAL_MS);
  flushTimer.unref?.();
}

export function appendBackendLog(event: string, payload: Record<string, unknown> = {}) {
  try {
    ensureRuntimeLogDirsSync();
    const row = sanitizeForBackendLog(JSON.stringify({ ts: new Date().toISOString(), event, ...payload }));
    pendingLines.push(`${row}\n`);
    scheduleFlush();
  } catch {
    // File logging must never break API handling.
  }
}

export async function drainBackendLogBuffer() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushBackendLogs();
}

export function registerBackendFileLogging(app: FastifyInstance) {
  ensureRuntimeLogDirsSync();
  rotateFileIfNeededSync(BACKEND_LOG_FILE, BACKEND_LOG_MAX_SIZE_BYTES, BACKEND_LOG_MAX_FILES);
  appendBackendLog("backend.boot", { pid: process.pid, node: process.version, platform: process.platform });

  app.addHook("onRequest", async (request) => {
    appendBackendLog("request.start", { method: request.method, url: request.url, ip: request.ip });
  });

  app.addHook("onResponse", async (request, reply) => {
    appendBackendLog("request.done", { method: request.method, url: request.url, statusCode: reply.statusCode, ip: request.ip });
  });

  app.addHook("onError", async (request, _reply, error) => {
    appendBackendLog("request.error", { method: request.method, url: request.url, ip: request.ip, error: error.message, stack: error.stack });
  });

  app.addHook("onClose", async () => {
    appendBackendLog("backend.shutdown", { pid: process.pid });
    await drainBackendLogBuffer();
  });
}

export async function writeJsonSnapshot(name: string, payload: unknown) {
  await fs.promises.mkdir(SNAPSHOT_DIR, { recursive: true });
  const safeName = name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const filePath = path.join(SNAPSHOT_DIR, safeName.endsWith(".json") ? safeName : `${safeName}.json`);
  await fs.promises.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}
