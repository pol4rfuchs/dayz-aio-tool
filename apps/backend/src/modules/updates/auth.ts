import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const steamAuthSchema = z.object({
  steamLoginMode: z.enum(["anonymous", "user"]).optional(),
  steamUsername: z.string().trim().optional().default(""),
  steamPassword: z.string().optional().default(""),
  steamGuardCode: z.string().trim().optional().default(""),
  useSteamLogin: z.boolean().optional()
}).optional();

export const steamAuthQuerySchema = z.object({
  steamLoginMode: z.enum(["anonymous", "user"]).optional(),
  steamUsername: z.string().trim().optional().default(""),
  useSteamLogin: z.union([z.literal("true"), z.literal("false"), z.boolean()]).optional()
}).optional();

export type SteamAuthInput = {
  steamLoginMode?: "anonymous" | "user";
  steamUsername?: string;
  steamPassword?: string;
  steamGuardCode?: string;
  useSteamLogin?: boolean | "true" | "false";
};

export type ResolvedSteamAuth = {
  mode: "anonymous" | "steam-user";
  steamLoginMode: "anonymous" | "user";
  username: string;
  password?: string;
  steamGuardCode?: string;
  passwordProvided: boolean;
  steamGuardCodeProvided: boolean;
  storesPassword: false;
};

function booleanish(value: unknown) {
  return value === true || value === "true";
}

export function resolveSteamLogin(input?: SteamAuthInput): ResolvedSteamAuth {
  const requestedMode = input?.steamLoginMode;
  const user = String(input?.steamUsername || process.env.DAYZ_AIO_STEAM_USERNAME || "").trim();
  const password = String(input?.steamPassword || "");
  const steamGuardCode = String(input?.steamGuardCode || "").trim();
  const legacyUseLogin = booleanish(input?.useSteamLogin);
  const wantsUser = requestedMode === "user" || legacyUseLogin || (!requestedMode && Boolean(user));
  if (wantsUser && user) {
    return {
      mode: "steam-user",
      steamLoginMode: "user",
      username: user,
      password: password || undefined,
      steamGuardCode: steamGuardCode || undefined,
      passwordProvided: Boolean(password),
      steamGuardCodeProvided: Boolean(steamGuardCode),
      storesPassword: false
    };
  }
  return { mode: "anonymous", steamLoginMode: "anonymous", username: "anonymous", passwordProvided: false, steamGuardCodeProvided: false, storesPassword: false };
}

export function buildSteamCmdLoginArgs(auth: ResolvedSteamAuth) {
  if (auth.steamLoginMode === "anonymous") return ["+login", "anonymous"];
  const args = ["+login", auth.username];
  if (auth.passwordProvided && auth.password) args.push(auth.password);
  if (auth.steamGuardCodeProvided && auth.steamGuardCode) args.push(auth.steamGuardCode);
  return args;
}

export function buildSteamCmdArgs(auth: ResolvedSteamAuth, tail: string[]) {
  return [...buildSteamCmdLoginArgs(auth), ...tail];
}

export function redactSteamCmdArgs(args: string[]) {
  const redacted: string[] = [];
  let loginField = 0;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "+login") {
      redacted.push(arg);
      loginField = 1;
      continue;
    }
    if (loginField > 0) {
      if (arg.startsWith("+")) {
        loginField = 0;
        redacted.push(arg);
        continue;
      }
      redacted.push(loginField === 1 && arg === "anonymous" ? "anonymous" : loginField === 1 ? "<steam-user>" : "<steam-secret>");
      loginField += 1;
      if (loginField > 3) loginField = 0;
      continue;
    }
    redacted.push(arg);
  }
  return redacted;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceLiteralSecret(text: string, secret: string | undefined, replacement = "<steam-secret>") {
  if (!secret) return text;
  const trimmed = String(secret);
  if (!trimmed) return text;
  return text.replace(new RegExp(escapeRegExp(trimmed), "g"), replacement);
}

export function redactSteamCmdOutput(output: string, auth?: ResolvedSteamAuth) {
  let text = String(output || "");
  if (!auth) return text;
  text = replaceLiteralSecret(text, auth.password, "<steam-secret>");
  text = replaceLiteralSecret(text, auth.steamGuardCode, "<steam-secret>");
  if (auth.steamLoginMode === "user" && auth.username) {
    const username = escapeRegExp(auth.username);
    text = text.replace(new RegExp(`(\\+login\\s+)${username}(?=\\s|$)`, "gi"), "$1<steam-user>");
  }
  return text;
}

export function redactSteamCmdOutputTail(output: string, auth?: ResolvedSteamAuth, maxLength = 8000) {
  return redactSteamCmdOutput(output, auth).slice(-maxLength);
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
      ? `Using SteamCMD user login for ${auth.username}. Password can be supplied for this one job, but is never stored by DayZ AIO.`
      : "Using anonymous SteamCMD login. Public Workshop can work; DayZ Dedicated Server AppID 223350 may fail with No subscription."
  });
  checks.push({
    name: "steam_password",
    status: auth.steamLoginMode === "anonymous" ? "pass" : auth.passwordProvided ? "pass" : "warn",
    message: auth.steamLoginMode === "anonymous"
      ? "No password is used in anonymous mode."
      : auth.passwordProvided
        ? "Password supplied for this request only. It is passed to SteamCMD and redacted from logs/audit; DayZ AIO does not store it."
        : "No password supplied. A cached SteamCMD session must already exist, or SteamCMD may ask for login/Steam Guard and fail in non-interactive mode."
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
    status: auth.steamLoginMode === "anonymous" ? "warn" : session.likelyUsableForUser || auth.passwordProvided ? "pass" : "warn",
    message: auth.steamLoginMode === "anonymous"
      ? "No Steam user selected. Cached user session is not required for anonymous mode."
      : session.likelyUsableForUser
        ? `Cached SteamCMD session/config found under ${session.steamcmdRoot}.`
        : auth.passwordProvided
          ? `No obvious cached session found under ${session.steamcmdRoot}, but a one-time password was supplied for SteamCMD login.`
          : `No obvious cached session for ${auth.username} found under ${session.steamcmdRoot}. Supply the password for this job or login once with SteamCMD.`
  });
  checks.push({
    name: "steam_guard",
    status: auth.steamLoginMode === "anonymous" ? "pass" : session.likelyUsableForUser || auth.steamGuardCodeProvided ? "pass" : "warn",
    message: auth.steamLoginMode === "anonymous"
      ? "Steam Guard is not used in anonymous mode."
      : session.likelyUsableForUser
        ? "Steam Guard/session reuse looks ready."
        : auth.steamGuardCodeProvided
          ? "Steam Guard code supplied for this request only."
          : "Steam Guard may be required. If SteamCMD reports Steam Guard/2FA, enter the current code and retry the job."
  });
  return { auth, session, checks };
}
