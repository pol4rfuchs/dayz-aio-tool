import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { detectLaunchProfile, type LaunchProfileDetection } from "./launchProfile.js";

export const detectExistingServerSchema = z.object({
  rootPath: z.string().min(1),
  profilePath: z.string().optional().default(""),
  executablePath: z.string().optional().default(""),
  missionPath: z.string().optional().default(""),
  launchParams: z.string().optional().default("")
});

export type ServerDetectionResult = {
  rootPath: string;
  profilePath: string;
  executablePath: string;
  configPath: string;
  missionPath: string;
  missionTemplate: string;
  typesPath: string;
  launchParams: string;
  launchProfile: LaunchProfileDetection;
  valid: boolean;
  confidence: "high" | "medium" | "low";
  checks: Array<{ key: string; label: string; ok: boolean; path?: string; message: string }>;
  warnings: string[];
  errors: string[];
};

async function exists(target: string) {
  try { await fs.access(target); return true; } catch { return false; }
}

async function isDirectory(target: string) {
  try { return (await fs.stat(target)).isDirectory(); } catch { return false; }
}

async function findFirstExisting(candidates: string[]) {
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  return "";
}

function normalizeWindowsLikePath(input: string) {
  return input.trim().replace(/^"|"$/g, "");
}

async function readMissionTemplate(configPath: string) {
  try {
    const cfg = await fs.readFile(configPath, "utf8");
    const match = cfg.match(/^\s*template\s*=\s*["']?([^"';\r\n]+)["']?\s*;/im);
    return match?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

async function findMissionPath(rootPath: string, explicitMissionPath: string, missionTemplate: string) {
  if (explicitMissionPath && await isDirectory(explicitMissionPath)) return explicitMissionPath;

  const missionsRoot = path.join(rootPath, "mpmissions");
  if (missionTemplate) {
    const exact = path.join(missionsRoot, missionTemplate);
    if (await exists(path.join(exact, "db", "types.xml"))) return exact;
  }

  try {
    const entries = await fs.readdir(missionsRoot, { withFileTypes: true });
    const candidates = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(missionsRoot, entry.name));

    for (const candidate of candidates) {
      if (missionTemplate && path.basename(candidate).toLowerCase() === missionTemplate.toLowerCase() && await exists(path.join(candidate, "db", "types.xml"))) return candidate;
    }
    for (const candidate of candidates) {
      if (await exists(path.join(candidate, "db", "types.xml"))) return candidate;
    }
  } catch {
    return "";
  }

  return "";
}

export async function detectExistingServer(rawInput: unknown): Promise<ServerDetectionResult> {
  const input = detectExistingServerSchema.parse(rawInput);
  const rootPath = path.resolve(normalizeWindowsLikePath(input.rootPath));

  const executablePath = normalizeWindowsLikePath(input.executablePath) || await findFirstExisting([
    path.join(rootPath, "DayZServer_x64.exe"),
    path.join(rootPath, "server", "DayZServer_x64.exe")
  ]);

  const configPath = path.join(rootPath, "serverDZ.cfg");
  const missionTemplate = await readMissionTemplate(configPath);
  const profilePath = normalizeWindowsLikePath(input.profilePath) || await findFirstExisting([
    path.join(rootPath, "profiles"),
    path.join(rootPath, "profile"),
    path.join(rootPath, "serverprofile")
  ]) || path.join(rootPath, "profiles");

  const missionPath = await findMissionPath(rootPath, normalizeWindowsLikePath(input.missionPath), missionTemplate);
  const typesPath = missionPath ? path.join(missionPath, "db", "types.xml") : "";

  const checks = [
    { key: "rootPath", label: "Server root folder", ok: await isDirectory(rootPath), path: rootPath, message: "Root folder must exist and contain the DayZ server files." },
    { key: "executablePath", label: "DayZServer_x64.exe", ok: Boolean(executablePath) && await exists(executablePath), path: executablePath || path.join(rootPath, "DayZServer_x64.exe"), message: "Executable must exist. This is what the backend starts." },
    { key: "serverDzCfg", label: "serverDZ.cfg", ok: await exists(configPath), path: configPath, message: "serverDZ.cfg is required for safe config editing." },
    { key: "missionTemplate", label: "serverDZ.cfg template", ok: Boolean(missionTemplate), path: configPath, message: missionTemplate ? `Active mission template detected: ${missionTemplate}` : "template=... could not be read. Mission auto-detection will fall back to first valid mpmissions entry." },
    { key: "profilePath", label: "Profile folder", ok: await isDirectory(profilePath), path: profilePath, message: "Profile folder should exist for logs, storage and server runtime data." },
    { key: "missionPath", label: "Mission folder", ok: Boolean(missionPath) && await isDirectory(missionPath), path: missionPath || path.join(rootPath, "mpmissions"), message: "Mission folder is selected from serverDZ.cfg template when possible." },
    { key: "typesXml", label: "types.xml", ok: Boolean(typesPath) && await exists(typesPath), path: typesPath || path.join(rootPath, "mpmissions", "<mission>", "db", "types.xml"), message: "types.xml is required for the economy editor." }
  ];

  const blocking = ["rootPath", "executablePath", "serverDzCfg"];
  const errors = checks.filter((check) => !check.ok && blocking.includes(check.key)).map((check) => `${check.label} missing or invalid.`);
  const warnings = checks.filter((check) => !check.ok && !blocking.includes(check.key)).map((check) => `${check.label} not detected. Some modules may not work yet.`);

  if (missionTemplate && missionPath && path.basename(missionPath).toLowerCase() !== missionTemplate.toLowerCase()) {
    warnings.push(`serverDZ.cfg template is ${missionTemplate}, but selected mission path is ${missionPath}. Check this before editing economy files.`);
  }

  const launchProfile = await detectLaunchProfile({
    rootPath,
    profilePath,
    launchParams: normalizeWindowsLikePath(input.launchParams)
  });
  const launchParams = launchProfile.recommendedLaunchParams;
  warnings.push(...launchProfile.warnings.map((warning) => `Launch profile: ${warning}`));

  const okCount = checks.filter((check) => check.ok).length;
  const confidence = errors.length === 0 && warnings.length === 0 ? "high" : errors.length === 0 && okCount >= 4 ? "medium" : "low";

  return { rootPath, profilePath, executablePath, configPath, missionPath, missionTemplate, typesPath, launchParams, launchProfile, valid: errors.length === 0, confidence, checks, warnings, errors };
}
