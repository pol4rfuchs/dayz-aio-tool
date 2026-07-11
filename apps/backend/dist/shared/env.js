import fs from "node:fs";
import path from "node:path";
function loadDotEnv() {
    const candidates = [
        path.resolve(process.cwd(), ".env"),
        path.resolve(process.cwd(), "apps/backend/.env"),
        path.resolve(process.cwd(), "../../apps/backend/.env")
    ];
    for (const file of candidates) {
        if (!fs.existsSync(file))
            continue;
        const content = fs.readFileSync(file, "utf8");
        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#"))
                continue;
            const index = line.indexOf("=");
            if (index <= 0)
                continue;
            const key = line.slice(0, index).trim();
            let value = line.slice(index + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (process.env[key] === undefined)
                process.env[key] = value;
        }
        break;
    }
}
loadDotEnv();
function findRepoPackageJson() {
    const candidates = [
        path.resolve(process.cwd(), "package.json"),
        path.resolve(process.cwd(), "../../package.json"),
        path.resolve(process.cwd(), "../../../package.json"),
        path.resolve(process.cwd(), "apps/backend/package.json")
    ];
    for (const candidate of candidates) {
        try {
            if (!fs.existsSync(candidate))
                continue;
            const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
            if (parsed.name === "dayz-aio" && parsed.version)
                return parsed.version;
        }
        catch {
            // try next candidate
        }
    }
    return "0.3.3-workshop-synchronization";
}
function boolEnv(name, fallback = false) {
    const value = process.env[name];
    if (value === undefined)
        return fallback;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
function csvEnv(name, fallback) {
    const value = process.env[name];
    if (!value)
        return fallback;
    return value.split(",").map((item) => item.trim()).filter(Boolean);
}
export const VERSION = findRepoPackageJson();
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "../../data");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");
export const LOG_DIR = path.resolve(process.env.DAYZ_AIO_LOG_DIR ?? path.join(DATA_DIR, "..", "logs"));
export const SNAPSHOT_DIR = path.join(LOG_DIR, "snapshots");
export const BACKEND_LOG_FILE = path.resolve(process.env.DAYZ_AIO_BACKEND_LOG_FILE ?? path.join(LOG_DIR, "backend.log"));
export const BACKEND_LOG_MAX_SIZE_BYTES = Number(process.env.DAYZ_AIO_BACKEND_LOG_MAX_SIZE_BYTES ?? 5 * 1024 * 1024);
export const BACKEND_LOG_MAX_FILES = Number(process.env.DAYZ_AIO_BACKEND_LOG_MAX_FILES ?? 5);
export const DB_PATH = path.join(DATA_DIR, "dayz-aio.sqlite");
export const DAYZ_ROOT = path.resolve(process.env.DAYZ_ROOT ?? "../../dayz-server");
export const LOG_BUFFER_LIMIT = Number(process.env.LOG_BUFFER_LIMIT ?? 1000);
export const HEALTH_TICK_MS = Number(process.env.HEALTH_TICK_MS ?? 5000);
export const REQUEST_BODY_LIMIT_BYTES = Number(process.env.DAYZ_AIO_REQUEST_BODY_LIMIT_BYTES ?? 10 * 1024 * 1024);
export const ECONOMY_XML_MAX_BYTES = Number(process.env.DAYZ_AIO_ECONOMY_XML_MAX_BYTES ?? 8 * 1024 * 1024);
export const WORKSHOP_STEAMCMD_TIMEOUT_MS = Number(process.env.DAYZ_AIO_WORKSHOP_STEAMCMD_TIMEOUT_MS ?? 15 * 60_000);
export const WORKSHOP_JOB_HISTORY_LIMIT = Number(process.env.DAYZ_AIO_WORKSHOP_JOB_HISTORY_LIMIT ?? 50);
export const AUTH_DISABLED = boolEnv("DAYZ_AIO_AUTH_DISABLED", false);
export const API_KEY = process.env.DAYZ_AIO_API_KEY ?? "";
export const SECRET_KEY = process.env.DAYZ_AIO_SECRET_KEY ?? "";
export const CORS_ORIGINS = csvEnv("DAYZ_AIO_CORS_ORIGINS", ["http://localhost:3100", "http://127.0.0.1:3100", "http://localhost:4173", "http://127.0.0.1:4173"]);
export const RATE_LIMIT_PER_MINUTE = Number(process.env.DAYZ_AIO_RATE_LIMIT_PER_MINUTE ?? 300);
export const AUTH_FAILURE_LIMIT_PER_MINUTE = Number(process.env.DAYZ_AIO_AUTH_FAILURE_LIMIT_PER_MINUTE ?? 20);
export const BATTLEYE_RCON_ENABLED = boolEnv("DAYZ_AIO_BATTLEYE_RCON_ENABLED", false);
export const RCON_TIMEOUT_MS = Number(process.env.DAYZ_AIO_RCON_TIMEOUT_MS ?? 5000);
export const SCHEDULE_MAX_RETRIES = Number(process.env.DAYZ_AIO_SCHEDULE_MAX_RETRIES ?? 2);
export const SCHEDULE_RETRY_DELAY_MINUTES = Number(process.env.DAYZ_AIO_SCHEDULE_RETRY_DELAY_MINUTES ?? 5);
export const SCHEDULE_ESCALATE_AFTER_FAILURES = Number(process.env.DAYZ_AIO_SCHEDULE_ESCALATE_AFTER_FAILURES ?? 3);
export function assertSecurityConfiguration() {
    if (AUTH_DISABLED)
        return;
    if (!API_KEY || API_KEY.length < 24) {
        throw new Error("DAYZ_AIO_API_KEY is missing or too short. Run install-windows.bat or set a strong API key in apps/backend/.env. For temporary isolated local development only, set DAYZ_AIO_AUTH_DISABLED=true.");
    }
    if (!SECRET_KEY || SECRET_KEY.length < 32) {
        throw new Error("DAYZ_AIO_SECRET_KEY is missing or too short. Run install-windows.bat or set a strong secret key in apps/backend/.env. For temporary isolated local development only, set DAYZ_AIO_AUTH_DISABLED=true.");
    }
}
