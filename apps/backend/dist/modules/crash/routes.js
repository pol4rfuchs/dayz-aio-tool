import fs from "node:fs/promises";
import path from "node:path";
import { sendError } from "../../shared/errors.js";
import { assertInsideRoot } from "../../shared/pathGuard.js";
import { requireServer } from "../servers/repository.js";
import { getLogs } from "../process/service.js";
import { writeAudit } from "../audit/service.js";
const CRASH_FILE = /(?:crash|exception|dump|mdmp|rpt|script).*\.(?:log|rpt|mdmp|txt)$/i;
const CRASH_LINE = /\b(exception|access violation|segmentation|fatal|crash|stack trace|assertion failed|out of memory|0x00020013|signature|cannot open|missing addon|OnStoreLoad|corrupted scripted variables)\b/i;
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function classifyCrashText(text) {
    const evidence = [];
    const actions = [];
    const entities = [];
    let category = "no-critical-pattern";
    let severity = "ok";
    let confidence = "low";
    for (const match of text.matchAll(/corrupted upon "([^"]+)"/gi))
        entities.push(match[1]);
    for (const match of text.matchAll(/Class:\s+'([^']+)'/gi))
        entities.push(match[1]);
    if (/0x00020013|Client Build:\s*\d+\s*Server Build:\s*\d+/i.test(text)) {
        category = "client-server-build-mismatch";
        severity = "fail";
        confidence = "high";
        evidence.push("Client/server build mismatch pattern detected.");
        actions.push("Stop server and run DayZ Dedicated Server SteamCMD update: app_update 223350 validate.");
    }
    if (/Weapon\.OnStoreLoad|EntityAI::OnStoreLoad|corrupted scripted variables|trying to set muzzle index|Access violation/i.test(text) && /OnStoreLoad/i.test(text)) {
        category = "persistence-corruption";
        severity = "fail";
        confidence = "high";
        evidence.push("OnStoreLoad/persistence load failure detected.");
        actions.push("Use Persistence Tools: scan storage_N, then quarantine storage_1 after stopping the server.");
        actions.push("Keep the quarantine copy; do not permanently delete world persistence until the clean start is confirmed.");
    }
    if (/signature check failed|wrong signature|not accepted by this server|\.bikey/i.test(text)) {
        category = "signature-or-key-mismatch";
        severity = "fail";
        confidence = "high";
        evidence.push("Signature/key mismatch pattern detected.");
        actions.push("Run Mod diagnostics and Key Sync, then restart the server.");
    }
    if (/missing addon|requires addon|cannot open object|cannot open file|No entry.*CfgPatches|Can't compile/i.test(text)) {
        category = category === "no-critical-pattern" ? "mod-dependency-or-pbo-error" : category;
        severity = severity === "ok" ? "fail" : severity;
        confidence = confidence === "low" ? "medium" : confidence;
        evidence.push("Missing dependency/PBO/config compile pattern detected.");
        actions.push("Run Mod diagnostics; verify load order, missing dependencies and Workshop update status.");
    }
    if (/access violation|unhandled exception|fatal/i.test(text) && severity === "ok") {
        category = "native-crash";
        severity = "fail";
        confidence = "medium";
        evidence.push("Native crash pattern detected.");
        actions.push("Open latest RPT/crash file tail and inspect the first script/mod error above the access violation.");
    }
    return { severity, category, confidence, evidence: unique(evidence), recommendedActions: unique(actions), entities: unique(entities).slice(0, 50) };
}
function mergeClassifications(items) {
    const ranking = { ok: 0, warn: 1, fail: 2 };
    const bySeverity = [...items].sort((a, b) => ranking[b.severity] - ranking[a.severity]);
    const top = bySeverity[0] ?? { severity: "ok", category: "no-critical-pattern", confidence: "low", evidence: [], recommendedActions: [], entities: [] };
    return {
        severity: top.severity,
        category: top.category,
        confidence: top.confidence,
        evidence: unique(items.flatMap((item) => item.evidence)).slice(0, 25),
        recommendedActions: unique(items.flatMap((item) => item.recommendedActions)).slice(0, 10),
        entities: unique(items.flatMap((item) => item.entities)).slice(0, 50)
    };
}
async function safeRealPath(input) {
    try {
        return await fs.realpath(input);
    }
    catch {
        return path.resolve(input);
    }
}
export async function walkCrashFiles(root, maxFiles = 750) {
    const files = [];
    const rootReal = await safeRealPath(root);
    async function isSafePath(candidate) {
        const real = await safeRealPath(candidate);
        try {
            assertInsideRoot(rootReal, real);
            return real;
        }
        catch {
            return null;
        }
    }
    async function visit(current) {
        if (files.length >= maxFiles)
            return;
        const currentReal = await isSafePath(current);
        if (!currentReal)
            return;
        let entries = [];
        try {
            entries = await fs.readdir(currentReal, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (files.length >= maxFiles)
                return;
            const candidate = path.join(currentReal, entry.name);
            let stat;
            try {
                stat = await fs.lstat(candidate);
            }
            catch {
                continue;
            }
            if (stat.isSymbolicLink())
                continue;
            const safeCandidate = await isSafePath(candidate);
            if (!safeCandidate)
                continue;
            if (stat.isDirectory()) {
                if (/node_modules|steamapps|@/i.test(entry.name))
                    continue;
                await visit(safeCandidate);
            }
            else if (stat.isFile() && CRASH_FILE.test(entry.name)) {
                files.push({ path: safeCandidate, name: entry.name, size: stat.size, modifiedAt: stat.mtime.toISOString() });
            }
        }
    }
    await visit(rootReal);
    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return files;
}
async function tail(filePath, maxBytes = 12000) {
    const stat = await fs.lstat(filePath);
    if (stat.isSymbolicLink())
        throw Object.assign(new Error("Refusing to read symlinked crash/log file."), { statusCode: 400 });
    const handle = await fs.open(filePath, "r");
    try {
        const fileStat = await handle.stat();
        const start = Math.max(0, fileStat.size - maxBytes);
        const buffer = Buffer.alloc(fileStat.size - start);
        await handle.read(buffer, 0, buffer.length, start);
        return buffer.toString("utf8");
    }
    finally {
        await handle.close();
    }
}
export async function crashRoutes(app) {
    app.get("/api/servers/:serverId/crash/scan", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const server = requireServer(serverId);
            const roots = [server.rootPath, server.profilePath].filter(Boolean);
            const found = [];
            for (const root of roots) {
                const safe = assertInsideRoot(server.rootPath, root === server.profilePath ? server.profilePath : server.rootPath);
                found.push(...await walkCrashFiles(safe));
            }
            const runtimeHits = getLogs(serverId, 700).filter((line) => CRASH_LINE.test(line)).slice(-80);
            const files = found.slice(0, 50);
            const classifications = [];
            if (runtimeHits.length)
                classifications.push(classifyCrashText(runtimeHits.join("\n")));
            for (const file of files.slice(0, 8)) {
                if (/\.mdmp$/i.test(file.name))
                    continue;
                try {
                    classifications.push(classifyCrashText(await tail(file.path, 20000)));
                }
                catch { /* skip unreadable */ }
            }
            const classification = mergeClassifications(classifications);
            const severity = classification.severity === "ok" && (runtimeHits.length || files.some((f) => /crash|exception|dump|mdmp/i.test(f.name))) ? "warn" : classification.severity;
            writeAudit({ serverId, action: "crash.scan", target: "logs", metadata: { files: files.length, runtimeHits: runtimeHits.length, severity, category: classification.category } });
            return { severity, classification: { ...classification, severity }, files, runtimeHits, note: "Heuristic DayZ crash intelligence. Use the recommended action as a safe workflow, not as destructive auto-repair." };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.get("/api/servers/:serverId/crash/file", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const file = String(request.query.path ?? "");
            const server = requireServer(serverId);
            const safe = assertInsideRoot(server.rootPath, file);
            const content = await tail(safe);
            return { path: safe, tail: content, classification: classifyCrashText(content) };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/api/servers/:serverId/crash/classify", async (request, reply) => {
        try {
            const text = String(request.body?.text ?? "");
            return classifyCrashText(text);
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
}
