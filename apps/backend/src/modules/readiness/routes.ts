import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { getDb } from "../../db/database.js";
import { API_KEY, AUTH_DISABLED, BACKUP_DIR, CORS_ORIGINS, DATA_DIR, SECRET_KEY } from "../../shared/env.js";
import { sendError } from "../../shared/errors.js";
import { requireServer } from "../servers/repository.js";
import { listBackups } from "../backups/service.js";
import { readServerDz, validateServerDz } from "../config/serverDz.js";
import { formatValidationSummary, validateTypesXml } from "../economy/parser.js";
import { getRuntimeStatus, preflightStartServer } from "../process/service.js";
import { writeJsonSnapshot } from "../../shared/logging.js";
import { maskJsonSecrets } from "../debug/masking.js";

export type ReadinessCheck = {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  message: string;
  requiredFor?: string[];
  path?: string;
};

function score(checks: ReadinessCheck[]) {
  const fail = checks.filter((c) => c.status === "fail").length;
  const warn = checks.filter((c) => c.status === "warn").length;
  const pass = checks.filter((c) => c.status === "pass").length;
  const total = Math.max(checks.length, 1);
  const percentage = Math.round(((pass + warn * 0.5) / total) * 100);
  return { pass, warn, fail, percentage, ready: fail === 0 };
}

async function canWrite(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
    const probe = path.join(dir, `.dayz-aio-write-test-${process.pid}.tmp`);
    await fs.writeFile(probe, "ok");
    await fs.rm(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

async function exists(filePath: string) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

export async function readinessRoutes(app: FastifyInstance) {
  app.get("/api/system/readiness", async () => {
    const checks: ReadinessCheck[] = [];
    checks.push({ key: "node", label: "Node.js runtime", status: Number(process.versions.node.split(".")[0]) >= 20 ? "pass" : "fail", message: `Detected ${process.version}; required >= 20.` });
    checks.push({ key: "platform", label: "Runtime platform", status: process.platform === "win32" ? "pass" : "warn", message: `Detected ${process.platform}. Windows is the primary MVP runtime.` });
    checks.push({ key: "security.auth", label: "API-Key authentication", status: AUTH_DISABLED ? "warn" : API_KEY.length >= 24 ? "pass" : "fail", message: AUTH_DISABLED ? "Auth is disabled by DAYZ_AIO_AUTH_DISABLED=true. Dev only." : API_KEY.length >= 24 ? "Strong API key configured." : "DAYZ_AIO_API_KEY missing or too short." });
    checks.push({ key: "security.secret", label: "Stored-secret encryption key", status: SECRET_KEY.length >= 32 ? "pass" : "fail", message: SECRET_KEY.length >= 32 ? "Secret key configured." : "DAYZ_AIO_SECRET_KEY missing or too short." });
    checks.push({ key: "security.cors", label: "CORS allowlist", status: CORS_ORIGINS.length > 0 && !CORS_ORIGINS.includes("*") ? "pass" : "fail", message: `Allowed origins: ${CORS_ORIGINS.join(", ")}` });
    checks.push({ key: "dataDir", label: "DATA_DIR writable", status: await canWrite(DATA_DIR) ? "pass" : "fail", message: DATA_DIR, path: DATA_DIR });
    checks.push({ key: "backupDir", label: "BACKUP_DIR writable", status: await canWrite(BACKUP_DIR) ? "pass" : "fail", message: BACKUP_DIR, path: BACKUP_DIR });
    try {
      getDb().prepare("SELECT 1").get();
      checks.push({ key: "sqlite", label: "SQLite access", status: "pass", message: "SQLite query OK." });
    } catch (error) {
      checks.push({ key: "sqlite", label: "SQLite access", status: "fail", message: (error as Error).message });
    }
    const result = { scope: "system", createdAt: new Date().toISOString(), ...score(checks), checks };
    await writeJsonSnapshot("system-readiness-last.json", maskJsonSecrets(result));
    await writeJsonSnapshot("readiness-last.json", maskJsonSecrets(result));
    return result;
  });

  app.get("/api/servers/:serverId/readiness", async (request, reply) => {
    try {
      const { serverId } = request.params as { serverId: string };
      const server = requireServer(serverId);
      const checks: ReadinessCheck[] = [];
      const serverCfg = path.join(server.rootPath, "serverDZ.cfg");
      const typesXml = server.missionPath ? path.join(server.missionPath, "db", "types.xml") : "";

      const preflight = await preflightStartServer(serverId);
      for (const check of preflight.checks) {
        checks.push({
          key: `start.${check.key}`,
          label: check.label,
          status: check.ok ? "pass" : check.blocking ? "fail" : "warn",
          message: check.ok ? "OK" : check.blocking ? "Required before Start." : "Recommended before full feature use.",
          path: check.path,
          requiredFor: check.blocking ? ["start"] : ["full-mvp"]
        });
      }

      try {
        const content = await readServerDz(serverId);
        const validation = validateServerDz(content);
        checks.push({ key: "config.serverdz.valid", label: "serverDZ.cfg validation", status: validation.valid ? "pass" : "fail", message: validation.valid ? "serverDZ.cfg basic validation passed." : validation.errors.join(" "), path: serverCfg, requiredFor: ["config-save", "start"] });
      } catch (error) {
        checks.push({ key: "config.serverdz.read", label: "serverDZ.cfg readable", status: "fail", message: (error as Error).message, path: serverCfg, requiredFor: ["config-save", "start"] });
      }

      if (typesXml && await exists(typesXml)) {
        try {
          const xml = await fs.readFile(typesXml, "utf8");
          const validation = validateTypesXml(xml);
          const status = !validation.valid ? "fail" : validation.warnings?.length ? "warn" : "pass";
          checks.push({
            key: "economy.types.valid",
            label: "types.xml validation",
            status,
            message: status === "pass" ? "types.xml validation passed." : formatValidationSummary(validation),
            path: typesXml,
            requiredFor: status === "fail" ? ["economy-save"] : ["economy-review"]
          });
        } catch (error) {
          checks.push({ key: "economy.types.read", label: "types.xml readable", status: "fail", message: (error as Error).message, path: typesXml, requiredFor: ["economy-save"] });
        }
      } else {
        checks.push({ key: "economy.types.missing", label: "types.xml detected", status: "warn", message: "types.xml not detected. Economy editor will be limited.", path: typesXml, requiredFor: ["economy-save"] });
      }

      const backups = listBackups(serverId) as Array<unknown>;
      checks.push({ key: "backup.exists", label: "At least one backup", status: backups.length > 0 ? "pass" : "warn", message: backups.length > 0 ? `${backups.length} backups found.` : "Create a manual backup before heavier tests.", requiredFor: ["go-live"] });

      const runtime = getRuntimeStatus(serverId);
      checks.push({ key: "runtime.status", label: "Runtime status known", status: runtime.status === "unknown" ? "warn" : "pass", message: `Current status: ${runtime.status}.`, requiredFor: ["monitoring"] });

      const result = score(checks);
      const nextActions = checks
        .filter((check) => check.status !== "pass")
        .slice(0, 6)
        .map((check) => ({ key: check.key, label: check.label, message: check.message }));

      const payload = { scope: "server", serverId, serverName: server.name, createdAt: new Date().toISOString(), ...result, nextActions, checks };
      await writeJsonSnapshot(`server-readiness-${serverId}-last.json`, maskJsonSecrets(payload));
      await writeJsonSnapshot("readiness-last.json", maskJsonSecrets(payload));
      return payload;
    } catch (error) { return sendError(reply, error); }
  });
}
