import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { getDb } from "../../db/database.js";
import { API_KEY, AUTH_DISABLED, BACKUP_DIR, CORS_ORIGINS, DATA_DIR, DB_PATH, SECRET_KEY, VERSION } from "../../shared/env.js";
import { sendError } from "../../shared/errors.js";
import { requireServer } from "../servers/repository.js";
import { detectExistingServer } from "../servers/detect.js";
import { getRuntimeStatus } from "../process/service.js";
import { writeJsonSnapshot } from "../../shared/logging.js";
import { maskJsonSecrets } from "../debug/masking.js";
async function exists(target) {
    try {
        await fs.access(target);
        return true;
    }
    catch {
        return false;
    }
}
async function isWritableDirectory(target) {
    try {
        await fs.mkdir(target, { recursive: true });
        const probe = path.join(target, `.dayz-aio-write-test-${Date.now()}.tmp`);
        await fs.writeFile(probe, "ok", "utf8");
        await fs.unlink(probe);
        return true;
    }
    catch {
        return false;
    }
}
async function fileInfo(target) {
    try {
        const stat = await fs.stat(target);
        return { exists: true, isFile: stat.isFile(), isDirectory: stat.isDirectory(), size: stat.size, mtime: stat.mtime.toISOString() };
    }
    catch (error) {
        return { exists: false, error: error.message };
    }
}
async function isPortFree(port, host = "127.0.0.1") {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => server.close(() => resolve(true)));
        server.listen(port, host);
    });
}
function summarize(checks) {
    const fail = checks.filter((check) => check.status === "fail").length;
    const warn = checks.filter((check) => check.status === "warn").length;
    return { ok: fail === 0, fail, warn, pass: checks.filter((check) => check.status === "pass").length };
}
function check(key, label, ok, message, pathValue, warn = false, details) {
    return { key, label, status: ok ? "pass" : warn ? "warn" : "fail", message, path: pathValue, details };
}
export async function doctorRoutes(app) {
    app.get("/api/system/doctor", async () => {
        const checks = [];
        const nodeMajor = Number(process.versions.node.split(".")[0]);
        checks.push(check("node.version", "Node.js version", nodeMajor >= 20, `Detected ${process.version}; required >= 20.`));
        checks.push(check("platform", "Runtime platform", true, `${process.platform} ${process.arch}`, undefined, false, { release: os.release(), cpus: os.cpus().length, totalMem: os.totalmem() }));
        checks.push(check("security.auth", "API authentication", AUTH_DISABLED || API_KEY.length >= 24, AUTH_DISABLED ? "Auth is disabled by explicit env flag. Dev only." : "Strong API key is configured.", undefined, AUTH_DISABLED));
        checks.push(check("security.secret", "Secret encryption key", SECRET_KEY.length >= 32, "Secret key is configured for stored credentials encryption."));
        checks.push(check("security.cors", "CORS allowlist", CORS_ORIGINS.length > 0 && !CORS_ORIGINS.includes("*"), `Allowed origins: ${CORS_ORIGINS.join(", ")}`, undefined, false, { origins: CORS_ORIGINS }));
        checks.push(check("cwd", "Backend working directory", await exists(process.cwd()), "Current backend directory exists.", process.cwd()));
        checks.push(check("data.dir", "Data directory writable", await isWritableDirectory(DATA_DIR), "DATA_DIR must be writable for SQLite and runtime state.", DATA_DIR));
        checks.push(check("backup.dir", "Backup directory writable", await isWritableDirectory(BACKUP_DIR), "Backup directory must be writable before editing server files.", BACKUP_DIR));
        checks.push(check("db.path", "SQLite database", await exists(DB_PATH), "SQLite DB file exists after initDatabase().", DB_PATH, true, await fileInfo(DB_PATH)));
        try {
            const row = getDb().prepare("SELECT COUNT(*) as count FROM servers").get();
            checks.push(check("db.query", "SQLite query", true, `Database query works. Servers registered: ${row.count}.`));
        }
        catch (error) {
            checks.push(check("db.query", "SQLite query", false, error.message));
        }
        const frontendPort = Number(process.env.DAYZ_AIO_FRONTEND_PORT ?? 3100);
        const backendPort = Number(process.env.PORT ?? 8090);
        const frontendFree = await isPortFree(frontendPort);
        checks.push({
            key: `port.${frontendPort}`,
            label: `Frontend dev port ${frontendPort}`,
            status: frontendFree ? "warn" : "pass",
            message: frontendFree ? "Frontend port is currently free. This is only a warning when the frontend is intentionally stopped." : "Frontend port is occupied as expected while the AIO frontend is running.",
            details: { expected: "occupied-when-frontend-running", port: frontendPort }
        });
        checks.push({
            key: `port.${backendPort}`,
            label: `Backend port ${backendPort}`,
            status: "pass",
            message: "Backend is running here, so this port is expected to be occupied.",
            details: { expected: "occupied-by-current-backend", port: backendPort }
        });
        const result = { ...summarize(checks), createdAt: new Date().toISOString(), version: VERSION, checks };
        await writeJsonSnapshot("system-doctor-last.json", maskJsonSecrets(result));
        await writeJsonSnapshot("doctor-last.json", maskJsonSecrets(result));
        return result;
    });
    app.get("/api/servers/:serverId/doctor", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const server = requireServer(serverId);
            const checks = [];
            const detection = await detectExistingServer({
                rootPath: server.rootPath,
                profilePath: server.profilePath,
                executablePath: server.executablePath,
                missionPath: server.missionPath,
                launchParams: server.launchParams
            });
            for (const item of detection.checks) {
                const critical = ["rootPath", "executablePath", "serverDzCfg"].includes(item.key);
                checks.push(check(`detect.${item.key}`, item.label, item.ok, item.message, item.path, !critical));
            }
            checks.push(check("mission.path", "Configured mission path", Boolean(server.missionPath), "Mission path should be detected for economy tools.", server.missionPath, true));
            checks.push(check("profile.path", "Configured profile path", Boolean(server.profilePath), "Profile path is used for runtime files/logs.", server.profilePath, true));
            checks.push(check("launch.params", "Launch parameters", Boolean(server.launchParams), "Launch params are required for Start/Restart.", undefined, true, server.launchParams));
            checks.push(check("serverdz.info", "serverDZ.cfg file info", true, "File stat result attached.", path.join(server.rootPath, "serverDZ.cfg"), false, await fileInfo(path.join(server.rootPath, "serverDZ.cfg"))));
            if (server.missionPath)
                checks.push(check("types.info", "types.xml file info", true, "File stat result attached.", path.join(server.missionPath, "db", "types.xml"), false, await fileInfo(path.join(server.missionPath, "db", "types.xml"))));
            checks.push(check("steamcmd.path", "SteamCMD path", !server.steamcmdPath || await exists(server.steamcmdPath), "Only required for Workshop update/install features.", server.steamcmdPath ?? undefined, true));
            checks.push(check("rcon.config", "RCON config", Boolean(server.rconHost && server.rconPort), "Only required for Player Admin/Kick/Ban features.", undefined, true, { host: server.rconHost, port: server.rconPort, passwordConfigured: Boolean(server.rconPassword) }));
            const runtime = getRuntimeStatus(serverId);
            checks.push(check("runtime.status", "Runtime status", true, `Status: ${runtime.status}`, undefined, false, runtime));
            const result = { ...summarize(checks), createdAt: new Date().toISOString(), serverId, detection, runtime, checks };
            await writeJsonSnapshot(`server-doctor-${serverId}-last.json`, maskJsonSecrets(result));
            await writeJsonSnapshot("doctor-last.json", maskJsonSecrets(result));
            return result;
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
}
