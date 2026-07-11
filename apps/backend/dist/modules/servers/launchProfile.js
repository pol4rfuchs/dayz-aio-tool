import fs from "node:fs/promises";
import path from "node:path";
const MANAGER_FILE_RE = /(?:server[_-]?manager|baseserver[_-]?manager|dayz[_-]?server[_-]?manager|dzsm|manager|config).*\.json$/i;
const SCRIPT_FILE_RE = /(?:server[_-]?manager|start|launch|server).*\.(?:bat|cmd|ps1|txt)$/i;
const PARAM_RE = /(?:^|\s)(-(?:config|profiles|port|mod|servermod|bepath|mission|name|dologs|adminlog|netlog|freezecheck|cpuCount|exThreads|limitFPS|filePatching|BEpath|scriptDebug|scrAllowFileWrite)\s*=\s*(?:"[^"]*"|'[^']*'|\S+)|-(?:dologs|adminlog|netlog|freezecheck|filePatching|scriptDebug|scrAllowFileWrite)\b)/gi;
async function exists(target) {
    try {
        await fs.access(target);
        return true;
    }
    catch {
        return false;
    }
}
async function isDir(target) {
    try {
        return (await fs.stat(target)).isDirectory();
    }
    catch {
        return false;
    }
}
function uniq(values) {
    const seen = new Set();
    const out = [];
    for (const value of values.map((item) => item.trim()).filter(Boolean)) {
        const key = value.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(value);
    }
    return out;
}
function normalize(input) {
    return input.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
}
function normalizeParamText(input) {
    return input
        .replace(/`"/g, "\"")
        .replace(/\$serverFolder/gi, "")
        .replace(/\r?\n/g, " ")
        .replace(/\s+/g, " ")
        .replace(/DayZServer_x64\.exe/ig, "")
        .trim();
}
function tokenName(token) {
    const unquoted = token.trim().replace(/^"|"$/g, "");
    return unquoted.match(/^-(\w+)/)?.[1]?.toLowerCase() ?? "";
}
function hasParam(params, name) {
    return splitLaunchParams(params).some((token) => tokenName(token) === name.toLowerCase());
}
function quoteParam(name, value) {
    const clean = String(value).replace(/^"|"$/g, "");
    const token = `-${name}=${clean}`;
    return /\s/.test(token) ? `"${token.replace(/"/g, "\\\"")}"` : token;
}
function splitLaunchParams(params) {
    return params.trim().length ? params.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((arg) => arg.replace(/^"|"$/g, "")) ?? [] : [];
}
function mergeLaunchParams(base, additions) {
    const tokens = splitLaunchParams(base);
    const names = new Set(tokens.map(tokenName).filter(Boolean));
    for (const addition of additions.filter(Boolean)) {
        const name = tokenName(addition);
        if (name && names.has(name))
            continue;
        tokens.push(addition.replace(/^"|"$/g, ""));
        if (name)
            names.add(name);
    }
    return tokens.map((token) => /\s/.test(token) ? `"${token.replace(/"/g, "\\\"")}"` : token).join(" ").trim();
}
function extractParamsFromText(text) {
    const matches = Array.from(text.matchAll(PARAM_RE)).map((match) => match[1]?.trim()).filter(Boolean);
    return normalizeParamText(matches.join(" "));
}
export function collectStrings(value, out = [], keyPath = "", depth = 0, seen = new WeakSet()) {
    if (depth > 20)
        return out;
    if (typeof value === "string") {
        const interestingKey = /(param|arg|start|launch|mod|profile|path|cmd|command|server)/i.test(keyPath);
        const interestingValue = /-(?:config|profiles|mod|servermod|port|bepath)\s*=|DayZServer_x64\.exe|@[^;\s]+/i.test(value);
        if (interestingKey || interestingValue)
            out.push(value);
        return out;
    }
    if (value && typeof value === "object") {
        if (seen.has(value))
            return out;
        seen.add(value);
    }
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1)
            collectStrings(value[index], out, `${keyPath}[${index}]`, depth + 1, seen);
        return out;
    }
    if (value && typeof value === "object") {
        for (const [key, nested] of Object.entries(value))
            collectStrings(nested, out, keyPath ? `${keyPath}.${key}` : key, depth + 1, seen);
    }
    return out;
}
function pickBestJsonParamCandidate(parsed) {
    const strings = collectStrings(parsed);
    const candidates = strings
        .map((item) => extractParamsFromText(item) || normalizeParamText(item))
        .filter((item) => /-(?:config|profiles|mod|servermod|port|bepath)\s*=/i.test(item));
    candidates.sort((a, b) => {
        const score = (input) => ["config", "profiles", "mod", "servermod", "bepath", "port"].filter((name) => hasParam(input, name)).length;
        return score(b) - score(a) || b.length - a.length;
    });
    return candidates[0] ?? "";
}
function extractArrayBlock(text, key) {
    const keyMatch = new RegExp(`"${key}"\\s*:`, "i").exec(text);
    if (!keyMatch)
        return "";
    const start = text.indexOf("[", keyMatch.index);
    if (start < 0)
        return "";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\") {
                escaped = true;
                continue;
            }
            if (char === "\"")
                inString = false;
            continue;
        }
        if (char === "\"") {
            inString = true;
            continue;
        }
        if (char === "[")
            depth += 1;
        if (char === "]") {
            depth -= 1;
            if (depth === 0)
                return text.slice(start + 1, index);
        }
    }
    return "";
}
function extractManagerIdArray(text, key) {
    const block = extractArrayBlock(text, key);
    if (!block)
        return [];
    const fromObjects = Array.from(block.matchAll(/"workshopId"\s*:\s*"?(\d{6,})"?/gi)).map((match) => match[1] ?? "");
    const fromStrings = Array.from(block.matchAll(/"(\d{6,})"/g)).map((match) => match[1] ?? "");
    return uniq([...fromObjects, ...fromStrings]);
}
function extractManagerStringArray(text, key) {
    const block = extractArrayBlock(text, key);
    if (!block)
        return [];
    return uniq(Array.from(block.matchAll(/"(@[^"]+|\d{6,})"/g)).map((match) => match[1] ?? ""));
}
function extractJsonString(text, key) {
    return text.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, "i"))?.[1]?.trim() ?? "";
}
function extractJsonNumber(text, keys, fallback) {
    for (const key of keys) {
        const raw = text.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`, "i"))?.[1];
        if (raw)
            return Number(raw);
    }
    return fallback;
}
function extractJsonBoolean(text, key) {
    return new RegExp(`"${key}"\\s*:\\s*true`, "i").test(text);
}
function resolveMaybeRelative(rootPath, candidate) {
    const clean = normalize(candidate);
    if (!clean)
        return "";
    return path.isAbsolute(clean) ? clean : path.join(rootPath, clean);
}
function buildManagerLaunchSource(filePath, rootPath, detectedProfilePath, content) {
    const steamMods = extractManagerIdArray(content, "steamWsMods");
    const steamServerMods = extractManagerIdArray(content, "steamWsServerMods");
    const localMods = extractManagerStringArray(content, "localMods");
    const localServerMods = extractManagerStringArray(content, "serverMods");
    const manualParams = extractManagerStringArray(content, "serverLaunchParams");
    const profileSetting = extractJsonString(content, "profilesPath");
    const profilePath = resolveMaybeRelative(rootPath, profileSetting) || detectedProfilePath;
    const port = extractJsonNumber(content, ["serverPort", "port"], 2302);
    const mods = uniq([...localMods, ...steamMods]);
    const serverMods = uniq([...localServerMods, ...steamServerMods]);
    if (!mods.length && !serverMods.length && !profileSetting && !manualParams.length)
        return null;
    const params = [quoteParam("config", path.join(rootPath, "serverDZ.cfg"))];
    if (mods.length)
        params.push(quoteParam("mod", mods.join(";")));
    if (serverMods.length)
        params.push(quoteParam("serverMod", serverMods.join(";")));
    params.push(quoteParam("bepath", path.join(rootPath, "battleye")));
    params.push(quoteParam("profiles", profilePath));
    params.push(quoteParam("port", port));
    const flagMap = [
        ["doLogs", "-dologs"],
        ["adminLog", "-adminlog"],
        ["netLog", "-netlog"],
        ["freezeCheck", "-freezecheck"],
        ["filePatching", "-filePatching"],
        ["scriptDebug", "-scriptDebug"],
        ["scrAllowFileWrite", "-scrAllowFileWrite"]
    ];
    for (const [key, flag] of flagMap)
        if (extractJsonBoolean(content, key))
            params.push(flag);
    const limitFps = extractJsonNumber(content, ["limitFps", "limitFPS"], 0);
    const cpuCount = extractJsonNumber(content, ["cpuCount"], 0);
    if (limitFps > 0)
        params.push(quoteParam("limitFPS", limitFps));
    if (cpuCount > 0)
        params.push(quoteParam("cpuCount", cpuCount));
    const manualLaunchParams = manualParams.map((item) => extractParamsFromText(item) || item).filter(Boolean).join(" ");
    const launchParams = mergeLaunchParams([...params, manualLaunchParams].filter(Boolean).join(" "), []);
    const hints = [
        "DayZ Server Manager JSON parsed with comment-tolerant text scanner.",
        `${mods.length} client/workshop mods imported from localMods + steamWsMods.`,
        `${serverMods.length} server mods imported from serverMods + steamWsServerMods.`
    ];
    if (profileSetting)
        hints.push(`profilesPath imported from manager config: ${profileSetting}`);
    if (manualParams.length)
        hints.push(`${manualParams.length} manual serverLaunchParams entries were merged when usable.`);
    return {
        filePath,
        type: "json",
        confidence: mods.length ? "high" : serverMods.length ? "medium" : "low",
        launchParams,
        hints,
        modCount: mods.length,
        serverModCount: serverMods.length,
        profilePath,
        port,
        importedFrom: "dayz-server-manager-json"
    };
}
function buildScriptLaunchSource(filePath, rootPath, detectedProfilePath, content) {
    const rawParams = extractParamsFromText(content);
    const hints = [];
    let launchParams = rawParams;
    const usesPsManagerLists = /modServerPar\.txt/i.test(content) && /serverModServerPar\.txt/i.test(content);
    const hasDefaultPsLaunch = /Start-Process[\s\S]{0,500}?DayZServer_x64\.exe[\s\S]{0,1200}?-mod=\$modsServer/i.test(content);
    if (usesPsManagerLists)
        hints.push("PowerShell manager reads modServerPar.txt and serverModServerPar.txt for -mod/-serverMod.");
    if (hasDefaultPsLaunch)
        hints.push("PowerShell default launch pattern detected: config, mod, serverMod, bepath, profiles, port, freezecheck, adminlog, dologs.");
    if (!launchParams && hasDefaultPsLaunch) {
        launchParams = [
            quoteParam("config", path.join(rootPath, "serverDZ.cfg")),
            quoteParam("bepath", path.join(rootPath, "battleye")),
            quoteParam("profiles", path.join(rootPath, "logs")),
            quoteParam("port", 2302),
            "-freezecheck",
            "-adminlog",
            "-dologs"
        ].join(" ");
    }
    if (!launchParams && !hints.length)
        return null;
    return {
        filePath,
        type: "script",
        confidence: hasParam(launchParams, "mod") ? "high" : launchParams ? "low" : "low",
        launchParams,
        hints: hints.length ? hints : ["Start script scanned for DayZ launch parameters."],
        profilePath: hasDefaultPsLaunch ? path.join(rootPath, "logs") : detectedProfilePath,
        port: 2302,
        importedFrom: "dayz-server-manager-ps1"
    };
}
async function detectModFolders(rootPath) {
    try {
        const entries = await fs.readdir(rootPath, { withFileTypes: true });
        const atFolders = entries.filter((entry) => entry.isDirectory() && entry.name.startsWith("@")).map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
        const idFolders = entries.filter((entry) => entry.isDirectory() && /^\d{6,}$/.test(entry.name)).map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
        return { atFolders, idFolders };
    }
    catch {
        return { atFolders: [], idFolders: [] };
    }
}
async function findCandidateFiles(rootPath) {
    const parentPath = path.dirname(rootPath);
    const searchDirs = Array.from(new Set([
        rootPath,
        parentPath,
        path.join(rootPath, "server_manager"),
        path.join(rootPath, "server-manager"),
        path.join(parentPath, "server_manager"),
        path.join(parentPath, "server-manager")
    ]));
    const files = [];
    for (const dir of searchDirs) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile())
                    continue;
                if (MANAGER_FILE_RE.test(entry.name) || SCRIPT_FILE_RE.test(entry.name))
                    files.push(path.join(dir, entry.name));
            }
        }
        catch {
            // ignore inaccessible optional parent/config dirs
        }
    }
    return uniq(files);
}
async function readParamListSource(rootPath, detectedProfilePath) {
    const parentPath = path.dirname(rootPath);
    const candidates = [
        [path.join(rootPath, "modServerPar.txt"), path.join(rootPath, "serverModServerPar.txt")],
        [path.join(rootPath, "server_manager", "modServerPar.txt"), path.join(rootPath, "server_manager", "serverModServerPar.txt")],
        [path.join(parentPath, "modServerPar.txt"), path.join(parentPath, "serverModServerPar.txt")]
    ];
    for (const [modsFile, serverModsFile] of candidates) {
        const mods = await exists(modsFile) ? uniq((await fs.readFile(modsFile, "utf8")).split(/[;\r\n]+/)) : [];
        const serverMods = await exists(serverModsFile) ? uniq((await fs.readFile(serverModsFile, "utf8")).split(/[;\r\n]+/)) : [];
        if (!mods.length && !serverMods.length)
            continue;
        const params = [
            quoteParam("config", path.join(rootPath, "serverDZ.cfg")),
            mods.length ? quoteParam("mod", mods.join(";")) : "",
            serverMods.length ? quoteParam("serverMod", serverMods.join(";")) : "",
            quoteParam("bepath", path.join(rootPath, "battleye")),
            quoteParam("profiles", detectedProfilePath),
            quoteParam("port", 2302),
            "-freezecheck",
            "-adminlog",
            "-dologs"
        ].filter(Boolean).join(" ");
        return {
            filePath: `${modsFile}; ${serverModsFile}`,
            type: "generated",
            confidence: mods.length ? "high" : "medium",
            launchParams: params,
            hints: ["Legacy PowerShell modServerPar/serverModServerPar files imported."],
            modCount: mods.length,
            serverModCount: serverMods.length,
            profilePath: detectedProfilePath,
            port: 2302,
            importedFrom: "fallback"
        };
    }
    return null;
}
async function readSourceFromFile(filePath, rootPath, detectedProfilePath) {
    const lower = filePath.toLowerCase();
    try {
        const content = await fs.readFile(filePath, "utf8");
        if (lower.endsWith(".json")) {
            const managerSource = buildManagerLaunchSource(filePath, rootPath, detectedProfilePath, content);
            let parsedLaunchParams = "";
            try {
                parsedLaunchParams = pickBestJsonParamCandidate(JSON.parse(content));
            }
            catch {
                parsedLaunchParams = extractParamsFromText(content);
            }
            if (managerSource && parsedLaunchParams) {
                managerSource.launchParams = mergeLaunchParams(managerSource.launchParams, splitLaunchParams(parsedLaunchParams));
                managerSource.hints.push("Explicit launch parameter strings from JSON were merged.");
            }
            return managerSource ?? (parsedLaunchParams ? {
                filePath,
                type: "json",
                confidence: ["config", "profiles", "mod", "servermod", "bepath", "port"].filter((name) => hasParam(parsedLaunchParams, name)).length >= 4 ? "high" : "medium",
                launchParams: parsedLaunchParams,
                hints: ["JSON manager/profile file scanned for explicit launch parameter strings."],
                importedFrom: "launch-params"
            } : null);
        }
        return buildScriptLaunchSource(filePath, rootPath, detectedProfilePath, content);
    }
    catch {
        return null;
    }
}
async function profileHasExpansion(profilePath) {
    if (!profilePath || !(await isDir(profilePath)))
        return false;
    return exists(path.join(profilePath, "ExpansionMod"));
}
function idsInLaunchParam(params, name) {
    const token = splitLaunchParams(params).find((item) => tokenName(item) === name);
    if (!token)
        return [];
    const value = token.replace(/^-[^=]+=/, "");
    return uniq(value.split(";").filter((entry) => /^\d{6,}$/.test(entry.trim())));
}
export async function detectLaunchProfile(input) {
    const rootPath = path.resolve(normalize(input.rootPath));
    const profilePath = input.profilePath ? path.resolve(normalize(input.profilePath)) : path.join(rootPath, "profiles");
    const explicitLaunchParams = normalize(input.launchParams ?? "");
    const { atFolders: modFolders, idFolders: modIdFolders } = await detectModFolders(rootPath);
    const candidateFiles = await findCandidateFiles(rootPath);
    const sources = [];
    const paramListSource = await readParamListSource(rootPath, profilePath);
    if (paramListSource)
        sources.push(paramListSource);
    for (const file of candidateFiles) {
        const source = await readSourceFromFile(file, rootPath, profilePath);
        if (source)
            sources.push(source);
    }
    sources.sort((a, b) => {
        const rank = { high: 3, medium: 2, low: 1 };
        const modScore = (source) => (source.modCount ?? 0) * 10 + (source.serverModCount ?? 0) * 5 + (hasParam(source.launchParams, "mod") ? 100 : 0);
        return rank[b.confidence] - rank[a.confidence] || modScore(b) - modScore(a) || b.launchParams.length - a.launchParams.length;
    });
    const source = sources[0];
    let recommendedLaunchParams = explicitLaunchParams || source?.launchParams || "";
    recommendedLaunchParams = mergeLaunchParams(recommendedLaunchParams, [
        quoteParam("config", path.join(rootPath, "serverDZ.cfg")),
        quoteParam("profiles", source?.profilePath || profilePath),
        quoteParam("port", source?.port ?? 2302)
    ]);
    const expansionByMod = [...modFolders, ...modIdFolders, ...idsInLaunchParam(recommendedLaunchParams, "mod")].some((folder) => /expansion/i.test(folder));
    const expansionByProfile = await profileHasExpansion(profilePath) || (source?.profilePath ? await profileHasExpansion(source.profilePath) : false);
    const managerMods = idsInLaunchParam(recommendedLaunchParams, "mod");
    const managerServerMods = idsInLaunchParam(recommendedLaunchParams, "servermod");
    const expansionDetected = expansionByMod || expansionByProfile;
    const hasModFolders = modFolders.length > 0 || modIdFolders.length > 0 || managerMods.length > 0;
    const hasModParam = hasParam(recommendedLaunchParams, "mod");
    const hasServerModParam = hasParam(recommendedLaunchParams, "servermod");
    const hasProfilesParam = hasParam(recommendedLaunchParams, "profiles");
    const hasConfigParam = hasParam(recommendedLaunchParams, "config");
    const hasPortParam = hasParam(recommendedLaunchParams, "port");
    const hasBepathParam = hasParam(recommendedLaunchParams, "bepath");
    const warnings = [];
    const errors = [];
    if (hasModFolders && !hasModParam)
        warnings.push(`${modFolders.length + modIdFolders.length} mod folders/IDs detected but launchParams has no -mod= entry. Import the old launch profile before starting a modded server.`);
    if (expansionDetected && !hasModParam)
        errors.push("Expansion indicators detected, but launchParams has no -mod= entry. Starting without the Expansion mod list can make the server exit during load.");
    if (expansionDetected && !hasServerModParam)
        warnings.push("Expansion profile/mod folders detected but no -servermod= entry found. This may be OK, but compare with the old manager profile.");
    if (!source && !explicitLaunchParams && hasModFolders)
        warnings.push("No old manager/start script launch profile was found automatically. Paste launchParams manually from your old manager.");
    if (!hasBepathParam && await exists(path.join(rootPath, "battleye")))
        warnings.push("BattlEye folder detected but no -bepath= entry found. Add it if your old manager used a custom BattlEye path.");
    if (source?.profilePath && path.resolve(source.profilePath).toLowerCase() !== path.resolve(profilePath).toLowerCase()) {
        warnings.push(`Launch profile source uses profile path ${source.profilePath}, while detected server profile path is ${profilePath}. Review before starting.`);
    }
    const missingImportedIds = [...managerMods, ...managerServerMods].filter((id) => !modIdFolders.includes(id) && !(modFolders.includes(`@${id}`)));
    if (missingImportedIds.length) {
        warnings.push(`${missingImportedIds.length} imported Workshop-ID mods are not visible as numeric folders in the server root. This is OK if your manager copies/links them before start; otherwise run mod update/import first. Examples: ${missingImportedIds.slice(0, 8).join(", ")}`);
    }
    return {
        rootPath,
        profilePath,
        recommendedLaunchParams,
        source,
        sources,
        modFolders,
        modIdFolders,
        managerMods,
        managerServerMods,
        expansionDetected,
        hasModFolders,
        hasModParam,
        hasServerModParam,
        hasProfilesParam,
        hasConfigParam,
        hasPortParam,
        hasBepathParam,
        warnings,
        errors
    };
}
