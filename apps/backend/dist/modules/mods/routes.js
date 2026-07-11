import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getDb } from "../../db/database.js";
import { requireServer } from "../servers/repository.js";
import { sendError } from "../../shared/errors.js";
import { writeAudit } from "../audit/service.js";
import { createBackup } from "../backups/service.js";
const loadOrderSchema = z.object({
    mods: z.array(z.object({
        folderName: z.string().min(1),
        enabled: z.boolean().default(true),
        workshopId: z.string().optional().nullable()
    }))
});
function modRows(serverId) {
    return getDb().prepare(`
    SELECT id, folder_name as folderName, display_name as displayName, workshop_id as workshopId, enabled, load_order as loadOrder, has_keys as hasKeys
    FROM mods WHERE server_id = ? ORDER BY load_order ASC, folder_name ASC
  `).all(serverId);
}
function normalizeModIdentity(name) {
    return name.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
async function fileExists(file) {
    try {
        await fs.access(file);
        return true;
    }
    catch {
        return false;
    }
}
async function listFilesRecursive(root, matcher, limit = 5000) {
    const result = [];
    async function walk(current) {
        if (result.length >= limit)
            return;
        let entries = [];
        try {
            entries = await fs.readdir(current, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (result.length >= limit)
                break;
            const full = path.join(current, entry.name);
            if (entry.isDirectory())
                await walk(full);
            else if (entry.isFile() && matcher(entry.name))
                result.push(full);
        }
    }
    await walk(root);
    return result;
}
async function readSmallTextIfExists(file, maxBytes = 128_000) {
    try {
        const stat = await fs.stat(file);
        if (stat.size > maxBytes)
            return "";
        return await fs.readFile(file, "utf8");
    }
    catch {
        return "";
    }
}
function parseArrayAssignments(text, names) {
    const found = new Set();
    for (const name of names) {
        const pattern = new RegExp(`${name}\\s*\\[\\]\\s*=\\s*\\{([^}]*)\\}`, "gis");
        for (const match of text.matchAll(pattern)) {
            const body = match[1] ?? "";
            for (const quoted of body.matchAll(/["']([^"']+)["']/g))
                found.add(quoted[1]);
        }
    }
    return [...found].sort();
}
async function analyzeMods(serverId) {
    const server = requireServer(serverId);
    const mods = modRows(serverId);
    const issues = [];
    const normalized = new Map();
    const pboOwners = new Map();
    const keyOwners = new Map();
    const declaredDependencies = [];
    for (const mod of mods) {
        const folderName = mod.folderName;
        const modPath = path.join(server.rootPath, folderName);
        const identity = normalizeModIdentity(folderName);
        normalized.set(identity, [...(normalized.get(identity) ?? []), folderName]);
        if (mod.enabled && !await fileExists(modPath)) {
            issues.push({ severity: "error", code: "MOD_FOLDER_MISSING", mod: folderName, message: `Enabled mod folder is missing: ${folderName}` });
            continue;
        }
        if (mod.enabled && !mod.hasKeys) {
            issues.push({ severity: "warning", code: "MISSING_BIKEY", mod: folderName, message: `Enabled mod has no .bikey file in its keys folder.` });
        }
        if (mod.enabled && !mod.workshopId) {
            issues.push({ severity: "info", code: "MISSING_WORKSHOP_ID", mod: folderName, message: `No Workshop ID is stored. Auto-update cannot manage this mod until workshopId is assigned.` });
        }
        const pboFiles = await listFilesRecursive(path.join(modPath, "addons"), (name) => name.toLowerCase().endsWith(".pbo"), 1500);
        for (const file of pboFiles) {
            const base = path.basename(file).toLowerCase();
            pboOwners.set(base, [...(pboOwners.get(base) ?? []), folderName]);
        }
        const keyFiles = await listFilesRecursive(path.join(modPath, "keys"), (name) => name.toLowerCase().endsWith(".bikey"), 500);
        for (const file of keyFiles) {
            const base = path.basename(file).toLowerCase();
            keyOwners.set(base, [...(keyOwners.get(base) ?? []), folderName]);
        }
        const modCpp = await readSmallTextIfExists(path.join(modPath, "mod.cpp"));
        const metaCpp = await readSmallTextIfExists(path.join(modPath, "meta.cpp"));
        const deps = parseArrayAssignments(`${modCpp}\n${metaCpp}`, ["dependencies", "requiredAddons", "requiredMods"]);
        if (deps.length)
            declaredDependencies.push({ mod: folderName, dependencies: deps });
    }
    for (const [identity, owners] of normalized) {
        if (owners.length > 1)
            issues.push({ severity: "warning", code: "DUPLICATE_NORMALIZED_MOD_NAME", message: `Multiple mod folders normalize to the same identity: ${owners.join(", ")}`, details: { identity, owners } });
    }
    for (const [pbo, owners] of pboOwners) {
        const unique = [...new Set(owners)];
        if (unique.length > 1)
            issues.push({ severity: "warning", code: "DUPLICATE_PBO_BASENAME", message: `Same PBO basename appears in multiple mods: ${pbo}`, details: { pbo, owners: unique } });
    }
    for (const [key, owners] of keyOwners) {
        const unique = [...new Set(owners)];
        if (unique.length > 1)
            issues.push({ severity: "info", code: "DUPLICATE_BIKEY_NAME", message: `Same .bikey filename appears in multiple mods: ${key}`, details: { key, owners: unique } });
    }
    const enabledNames = new Set(mods.filter((m) => m.enabled).flatMap((m) => [m.folderName.toLowerCase(), normalizeModIdentity(m.folderName)]));
    for (const entry of declaredDependencies) {
        const missing = entry.dependencies.filter((dep) => !enabledNames.has(dep.toLowerCase()) && !enabledNames.has(normalizeModIdentity(dep)));
        if (missing.length)
            issues.push({ severity: "warning", code: "DECLARED_DEPENDENCY_NOT_MATCHED", mod: entry.mod, message: `Mod declares dependencies that were not matched against enabled folder names.`, details: { missing } });
    }
    const summary = {
        mods: mods.length,
        enabled: mods.filter((m) => m.enabled).length,
        errors: issues.filter((i) => i.severity === "error").length,
        warnings: issues.filter((i) => i.severity === "warning").length,
        info: issues.filter((i) => i.severity === "info").length,
        duplicatePbos: [...pboOwners.values()].filter((owners) => new Set(owners).size > 1).length,
        duplicateKeys: [...keyOwners.values()].filter((owners) => new Set(owners).size > 1).length
    };
    return { summary, issues, declaredDependencies };
}
async function keySyncPlan(serverId) {
    const server = requireServer(serverId);
    const mods = modRows(serverId);
    const enabled = mods.filter((m) => m.enabled);
    const serverKeysPath = path.join(server.rootPath, "keys");
    const existingServerKeys = new Set();
    try {
        const entries = await fs.readdir(serverKeysPath);
        for (const entry of entries.filter((name) => name.toLowerCase().endsWith(".bikey")))
            existingServerKeys.add(entry.toLowerCase());
    }
    catch {
        // keys folder can be created by sync.
    }
    const plan = [];
    const missingModKeys = [];
    for (const mod of enabled) {
        const keyDir = path.join(server.rootPath, mod.folderName, "keys");
        let keyFiles = [];
        try {
            keyFiles = (await fs.readdir(keyDir)).filter((name) => name.toLowerCase().endsWith(".bikey"));
        }
        catch {
            keyFiles = [];
        }
        if (!keyFiles.length) {
            missingModKeys.push(mod.folderName);
            continue;
        }
        for (const key of keyFiles) {
            const source = path.join(keyDir, key);
            const target = path.join(serverKeysPath, key);
            plan.push({ mod: mod.folderName, source, target, action: existingServerKeys.has(key.toLowerCase()) ? "exists" : "copy" });
        }
    }
    const toCopy = plan.filter((item) => item.action === "copy");
    return { serverKeysPath, totalKeys: plan.length, copyCount: toCopy.length, existingCount: plan.length - toCopy.length, missingModKeys, plan };
}
async function syncKeys(serverId) {
    const server = requireServer(serverId);
    const plan = await keySyncPlan(serverId);
    await fs.mkdir(plan.serverKeysPath, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(server.rootPath, `keys_BACKUP_${stamp}`);
    let backedUp = false;
    try {
        const existing = await fs.readdir(plan.serverKeysPath);
        if (existing.some((name) => name.toLowerCase().endsWith(".bikey"))) {
            await fs.cp(plan.serverKeysPath, backupDir, { recursive: true, force: false });
            backedUp = true;
        }
    }
    catch {
        // no backup needed
    }
    const copied = [];
    for (const item of plan.plan.filter((entry) => entry.action === "copy")) {
        await fs.copyFile(item.source, item.target);
        copied.push({ source: item.source, target: item.target, mod: item.mod });
    }
    writeAudit({ serverId, action: "mods.key_sync", target: plan.serverKeysPath, metadata: { copied: copied.length, backupDir: backedUp ? backupDir : null, missingModKeys: plan.missingModKeys } });
    return { ok: true, copied, backupDir: backedUp ? backupDir : null, plan: await keySyncPlan(serverId) };
}
export async function modRoutes(app) {
    app.get("/", async (request, reply) => {
        try {
            const { serverId } = request.params;
            requireServer(serverId);
            return modRows(serverId);
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/scan", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const server = requireServer(serverId);
            const entries = await fs.readdir(server.rootPath, { withFileTypes: true });
            const modFolders = entries
                .filter((entry) => entry.isDirectory() && (entry.name.startsWith("@") || /^\d{6,}$/.test(entry.name)))
                .sort((a, b) => a.name.localeCompare(b.name));
            const now = new Date().toISOString();
            const db = getDb();
            const insert = db.prepare(`
        INSERT OR IGNORE INTO mods
        (id, server_id, folder_name, display_name, workshop_id, enabled, load_order, has_keys, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `);
            const update = db.prepare("UPDATE mods SET workshop_id = COALESCE(?, workshop_id), has_keys = ?, updated_at = ? WHERE id = ?");
            let index = 0;
            for (const folder of modFolders) {
                const keysPath = path.join(server.rootPath, folder.name, "keys");
                let hasKeys = 0;
                try {
                    const keyEntries = await fs.readdir(keysPath);
                    hasKeys = keyEntries.some((name) => name.toLowerCase().endsWith(".bikey")) ? 1 : 0;
                }
                catch {
                    hasKeys = 0;
                }
                const workshopId = /^\d{6,}$/.test(folder.name) ? folder.name : null;
                const id = `${serverId}:${folder.name}`;
                insert.run(id, serverId, folder.name, folder.name.replace(/^@/, ""), workshopId, index++, hasKeys, now, now);
                update.run(workshopId, hasKeys, now, id);
            }
            writeAudit({ serverId, action: "mods.scan", target: server.rootPath, metadata: { detected: modFolders.length, supportsNumericWorkshopFolders: true } });
            return { detected: modFolders.length, mods: modRows(serverId) };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.put("/load-order", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const server = requireServer(serverId);
            const input = loadOrderSchema.parse(request.body);
            await createBackup({ serverId, type: "mods", reason: "mod load order change", files: [path.join(server.rootPath, "serverDZ.cfg")] });
            const now = new Date().toISOString();
            const db = getDb();
            const update = db.prepare("UPDATE mods SET enabled = ?, load_order = ?, workshop_id = COALESCE(?, workshop_id), updated_at = ? WHERE server_id = ? AND folder_name = ?");
            input.mods.forEach((mod, index) => update.run(mod.enabled ? 1 : 0, index, mod.workshopId ?? null, now, serverId, mod.folderName));
            writeAudit({ serverId, action: "mods.load_order", target: "mods", metadata: input });
            return { ok: true, startParams: buildModStartParams(serverId), mods: modRows(serverId) };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.get("/diagnostics", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const result = await analyzeMods(serverId);
            writeAudit({ serverId, action: "mods.diagnostics", target: "mods", metadata: result.summary });
            return result;
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.get("/key-sync/plan", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const result = await keySyncPlan(serverId);
            writeAudit({ serverId, action: "mods.key_sync.plan", target: result.serverKeysPath, metadata: { copyCount: result.copyCount, missingModKeys: result.missingModKeys.length } });
            return result;
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/key-sync", async (request, reply) => {
        try {
            const { serverId } = request.params;
            return await syncKeys(serverId);
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.get("/start-params", async (request, reply) => {
        try {
            return { modParam: buildModStartParams(request.params.serverId) };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
}
export function buildModStartParams(serverId) {
    const mods = getDb().prepare("SELECT folder_name as folderName FROM mods WHERE server_id = ? AND enabled = 1 ORDER BY load_order ASC").all(serverId);
    if (!mods.length)
        return "";
    return `-mod=${mods.map((mod) => mod.folderName).join(";")}`;
}
