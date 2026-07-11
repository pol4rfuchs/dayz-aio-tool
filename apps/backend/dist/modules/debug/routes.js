import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { BACKEND_LOG_FILE, LOG_DIR, SNAPSHOT_DIR, VERSION } from "../../shared/env.js";
import { writeJsonSnapshot } from "../../shared/logging.js";
import { maskSecrets } from "./masking.js";
import { createStoredZip } from "./zip.js";
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
async function readTextForBundle(filePath) {
    const stat = await fs.stat(filePath);
    const handle = await fs.open(filePath, "r");
    try {
        const size = Math.min(stat.size, MAX_TEXT_FILE_BYTES);
        const start = Math.max(0, stat.size - size);
        const buffer = Buffer.alloc(size);
        await handle.read(buffer, 0, size, start);
        const prefix = stat.size > MAX_TEXT_FILE_BYTES ? `[DayZ AIO] File tailed. Original size ${stat.size} bytes. Last ${size} bytes included.\n\n` : "";
        return maskSecrets(`${prefix}${buffer.toString("utf8")}`);
    }
    finally {
        await handle.close();
    }
}
async function addFile(entries, source, zipName, options) {
    try {
        const stat = await fs.stat(source);
        if (!stat.isFile())
            return;
        if (options?.mask ?? true) {
            entries.push({ name: zipName, content: await readTextForBundle(source), date: stat.mtime });
        }
        else {
            entries.push({ name: zipName, content: await fs.readFile(source), date: stat.mtime });
        }
    }
    catch (error) {
        if (!options?.optional) {
            entries.push({ name: `${zipName}.missing.txt`, content: `Could not read ${source}: ${error.message}\n` });
        }
    }
}
async function addFilesFromDir(entries, dir, zipPrefix, pattern) {
    try {
        const rows = await fs.readdir(dir, { withFileTypes: true });
        for (const row of rows) {
            const full = path.join(dir, row.name);
            if (row.isDirectory()) {
                await addFilesFromDir(entries, full, `${zipPrefix}/${row.name}`, pattern);
            }
            else if (row.isFile() && (!pattern || pattern.test(row.name))) {
                await addFile(entries, full, `${zipPrefix}/${row.name}`, { optional: true });
            }
        }
    }
    catch {
        // Optional by design.
    }
}
async function findRepoRoot() {
    const candidates = [process.cwd(), path.resolve(process.cwd(), "../..")];
    for (const candidate of candidates) {
        try {
            const raw = await fs.readFile(path.join(candidate, "package.json"), "utf8");
            const parsed = JSON.parse(raw);
            if (parsed.name === "dayz-aio" || parsed.workspaces)
                return candidate;
        }
        catch {
            // try next candidate
        }
    }
    return process.cwd();
}
async function readProjectVersion(repoRoot) {
    try {
        const raw = await fs.readFile(path.join(repoRoot, "package.json"), "utf8");
        const parsed = JSON.parse(raw);
        return parsed.version ?? VERSION;
    }
    catch {
        return VERSION;
    }
}
async function buildBundle() {
    const repoRoot = await findRepoRoot();
    const projectVersion = await readProjectVersion(repoRoot);
    const createdAt = new Date().toISOString();
    const entries = [];
    const manifest = {
        name: "DayZ AIO Debug Bundle",
        version: projectVersion,
        runtimeVersion: VERSION,
        createdAt,
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        hostname: os.hostname(),
        cwd: process.cwd(),
        repoRoot,
        logDir: LOG_DIR,
        snapshotDir: SNAPSHOT_DIR,
        backendLogFile: BACKEND_LOG_FILE,
        note: "Secrets are masked. SQLite DB and raw credentials are intentionally excluded."
    };
    await writeJsonSnapshot("debug-bundle-last.json", manifest);
    entries.push({ name: "manifest.json", content: `${JSON.stringify(manifest, null, 2)}\n` });
    await addFile(entries, path.join(repoRoot, "README.md"), "project/README.md", { optional: true });
    await addFile(entries, path.join(repoRoot, "package.json"), "project/package.json", { optional: true });
    await addFile(entries, path.join(repoRoot, "apps/backend/package.json"), "project/apps-backend-package.json", { optional: true });
    await addFile(entries, path.join(repoRoot, "apps/frontend/package.json"), "project/apps-frontend-package.json", { optional: true });
    await addFile(entries, path.join(repoRoot, "apps/backend/.env"), "config/backend.env.masked", { optional: true });
    await addFilesFromDir(entries, path.join(repoRoot, "docs"), "docs", /^(API|SECURITY|IMPLEMENTED_|MVP_).+\.md$/i);
    await addFilesFromDir(entries, LOG_DIR, "logs", /\.(log|txt|json)$/i);
    // Add rotated backend logs only when backend log is outside the configured LOG_DIR traversal.
    const normalizedLogDir = path.resolve(LOG_DIR).toLowerCase();
    const normalizedBackendLog = path.resolve(BACKEND_LOG_FILE).toLowerCase();
    if (!normalizedBackendLog.startsWith(normalizedLogDir)) {
        await addFile(entries, BACKEND_LOG_FILE, "logs/backend.log", { optional: true });
        for (let index = 1; index <= 5; index += 1) {
            await addFile(entries, `${BACKEND_LOG_FILE}.${index}`, `logs/backend.log.${index}`, { optional: true });
        }
    }
    return createStoredZip(entries);
}
export async function debugRoutes(app) {
    app.get("/api/debug/status", async () => ({
        ok: true,
        version: VERSION,
        logDir: LOG_DIR,
        snapshotDir: SNAPSHOT_DIR,
        backendLogFile: BACKEND_LOG_FILE,
        createdAt: new Date().toISOString()
    }));
    app.get("/api/debug/bundle", async (_request, reply) => {
        const zip = await buildBundle();
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        return reply
            .header("content-type", "application/zip")
            .header("content-disposition", `attachment; filename="dayz-aio-debug-${stamp}.zip"`)
            .send(zip);
    });
}
