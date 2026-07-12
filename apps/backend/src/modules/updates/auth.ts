import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const steamAuthSchema = z.object({
  steamLoginMode: z.enum(["anonymous", "user"]).optional(),
  steamUsername: z.string().trim().optional().default(""),
  useSteamLogin: z.boolean().optional()
}).optional();

export const steamAuthQuerySchema = z.object({
  steamLoginMode: z.enum(["anonymous", "user"]).optional(),
  steamUsername: z.string().trim().optional().default(""),
  useSteamLogin: z.union([z.literal("true"), z.literal("false"), z.boolean()]).optional()
}).optional();

export type SteamAuthInput = { steamLoginMode?: "anonymous" | "user"; steamUsername?: string; useSteamLogin?: boolean | "true" | "false" };

export type ResolvedSteamAuth = {
  mode: "anonymous" | "steam-user";
  steamLoginMode: "anonymous" | "user";
  username: string;
  storesPassword: false;
};

function booleanish(value: unknown) {
  return value === true || value === "true";
}

export function resolveSteamLogin(input?: SteamAuthInput): ResolvedSteamAuth {
  const requestedMode = input?.steamLoginMode;
  const user = String(input?.steamUsername || process.env.DAYZ_AIO_STEAM_USERNAME || "").trim();
  const legacyUseLogin = booleanish(input?.useSteamLogin);
  const wantsUser = requestedMode === "user" || legacyUseLogin || (!requestedMode && Boolean(user));
  if (wantsUser && user) {
    return { mode: "steam-user", steamLoginMode: "user", username: user, storesPassword: false };
  }
  return { mode: "anonymous", steamLoginMode: "anonymous", username: "anonymous", storesPassword: false };
}

export function buildSteamCmdLoginArgs(auth: ResolvedSteamAuth) {
  return ["+login", auth.username];
}

export function buildSteamCmdArgs(auth: ResolvedSteamAuth, tail: string[]) {
  return [...buildSteamCmdLoginArgs(auth), ...tail];
}

export function redactSteamCmdArgs(args: string[]) {
  return args.map((arg, idx) => idx > 0 && args[idx - 1] === "+login" && arg !== "anonymous" ? "<steam-user>" : arg);
}

async function readIfExists(file: string) {
  try { return await fs.readFile(file, "utf8"); } catch { return ""; }
}

export async function detectSteamCachedSession(steamcmdPath: string, steamUsername = "") {
  const steamcmdRoot = path.dirname(steamcmdPath);
  const candidates = [
    path.join(steamcmdRoot, "config", "loginusers.vdf"),
    path.join(steamcmdRoot, "config", "config.vdf")
  ];
  const texts = await Promise.all(candidates.map(readIfExists));
  const combined = texts.join("\n");
  const anyConfig = combined.trim().length > 0;
  const normalized = combined.toLowerCase();
  const user = steamUsername.trim().toLowerCase();
  const userMentioned = user ? normalized.includes(user) : false;
  const accountNameMentioned = /"accountname"\s+"[^"]+"/i.test(combined);
  return {
    steamcmdRoot,
    configFiles: candidates,
    anyConfig,
    userMentioned,
    accountNameMentioned,
    likelyUsableForUser: Boolean(user && (userMentioned || accountNameMentioned)),
    likelyAnyCachedUser: Boolean(accountNameMentioned || /"users"\s*\{/i.test(combined))
  };
}

export async function buildSteamAuthChecks(steamcmdPath: string, auth: ResolvedSteamAuth) {
  const session = await detectSteamCachedSession(steamcmdPath, auth.steamLoginMode === "user" ? auth.username : "");
  const checks: Array<{ name: string; status: "pass" | "warn" | "fail"; message: string }> = [];
  checks.push({
    name: "steam_login_mode",
    status: auth.steamLoginMode === "user" ? "pass" : "warn",
    message: auth.steamLoginMode === "user"
      ? `Using SteamCMD cached user session for ${auth.username}. Password is not stored or passed by DayZ AIO.`
      : "Using anonymous SteamCMD login. Public Workshop can work; DayZ Dedicated Server AppID 223350 may fail with No subscription."
  });
  checks.push({
    name: "anonymous_possible",
    status: auth.steamLoginMode === "anonymous" ? "warn" : "pass",
    message: auth.steamLoginMode === "anonymous"
      ? "Anonymous will be tried. If SteamCMD returns No subscription, Access Denied, Steam Guard, or login failure, switch to Steam user mode."
      : "Anonymous fallback remains available by switching login mode back to anonymous."
  });
  checks.push({
    name: "steam_user_session",
    status: auth.steamLoginMode === "anonymous" ? "warn" : session.likelyUsableForUser ? "pass" : "warn",
    message: auth.steamLoginMode === "anonymous"
      ? "No Steam user selected. Cached user session is not required for anonymous mode."
      : session.likelyUsableForUser
        ? `Cached SteamCMD session/config found under ${session.steamcmdRoot}.`
        : `No obvious cached session for ${auth.username} found under ${session.steamcmdRoot}. Run SteamCMD login manually once and approve Steam Guard.`
  });
  checks.push({
    name: "steam_guard",
    status: auth.steamLoginMode === "anonymous" ? "pass" : session.likelyUsableForUser ? "pass" : "warn",
    message: auth.steamLoginMode === "anonymous"
      ? "Steam Guard is not used in anonymous mode."
      : session.likelyUsableForUser
        ? "Steam Guard/session reuse looks ready."
        : "Steam Guard may be required. DayZ AIO never stores the password; login once with SteamCMD outside the UI."
  });
  return { auth, session, checks };
}
