import fs from "node:fs/promises";
import path from "node:path";
export const DZSA_KNOWN_CANDIDATE_NAMES = [
    "DZSALModServer.exe",
    "DZSALModServer_x64.exe",
    "DZSALModServer",
    "@DZSALModServer",
    "DZSA_Launcher_Server"
];
function candidateType(stat) {
    return stat.isDirectory() ? "directory" : "file";
}
function dedupePush(candidates, candidate) {
    const normalized = candidate.path.toLowerCase();
    if (!candidates.some((item) => item.path.toLowerCase() === normalized))
        candidates.push(candidate);
}
export async function findDzsaCandidates(rootPath) {
    const found = [];
    for (const name of DZSA_KNOWN_CANDIDATE_NAMES) {
        const candidatePath = path.join(rootPath, name);
        try {
            const stat = await fs.stat(candidatePath);
            dedupePush(found, { path: candidatePath, name, type: candidateType(stat), source: "known-name" });
        }
        catch { /* not present */ }
    }
    try {
        const entries = await fs.readdir(rootPath, { withFileTypes: true });
        for (const entry of entries) {
            if (!/dzsa|dzsalmodserver/i.test(entry.name))
                continue;
            const fullPath = path.join(rootPath, entry.name);
            dedupePush(found, {
                path: fullPath,
                name: entry.name,
                type: entry.isDirectory() ? "directory" : "file",
                source: "fuzzy-scan"
            });
        }
    }
    catch { /* ignore unreadable root */ }
    return found;
}
export async function hasDzsaLauncherServer(rootPath) {
    return (await findDzsaCandidates(rootPath)).length > 0;
}
