import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";

const DAYZ_DEDICATED_SERVER_APP_ID = "223350";

export type ServerExeSnapshot = {
  exists: boolean;
  path: string;
  size?: number;
  mtimeMs?: number;
  lastWriteTime?: string;
  fileVersion?: string;
  productVersion?: string;
};

export async function getServerExeSnapshot(server: any): Promise<ServerExeSnapshot> {
  const exePath = server.executablePath || path.join(server.rootPath, "DayZServer_x64.exe");
  try {
    const stat = await fs.stat(exePath);
    const version = await readWindowsExeVersion(exePath);
    return {
      exists: true,
      path: exePath,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      lastWriteTime: stat.mtime.toISOString(),
      fileVersion: version.fileVersion,
      productVersion: version.productVersion
    };
  } catch {
    return { exists: false, path: exePath };
  }
}

export async function readWindowsExeVersion(exePath: string) {
  if (process.platform !== "win32") return {};
  const ps = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `$v=(Get-Item -LiteralPath ${JSON.stringify(exePath)}).VersionInfo; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); Write-Output ($v.FileVersion + '|'+ $v.ProductVersion)`
  ];
  try {
    const result = await execa("powershell.exe", ps, { reject: false, all: true, timeout: 15_000 });
    const line = String(result.all || "").trim().split(/\r?\n/).pop() || "";
    const [fileVersion, productVersion] = line.split("|");
    return { fileVersion: fileVersion || undefined, productVersion: productVersion || undefined };
  } catch {
    return {};
  }
}

export function serverExeChanged(before: ServerExeSnapshot, after: ServerExeSnapshot) {
  if (!before.exists || !after.exists) return false;
  return before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.fileVersion !== after.fileVersion || before.productVersion !== after.productVersion;
}

export type AppManifestSummary = {
  path: string;
  exists: boolean;
  stateFlags?: string;
  installDir?: string;
  lastUpdated?: string;
  buildId?: string;
};

export async function readAppManifestSummary(server: any, appId = DAYZ_DEDICATED_SERVER_APP_ID): Promise<AppManifestSummary> {
  const manifest = path.join(server.rootPath, "steamapps", `appmanifest_${appId}.acf`);
  try {
    const text = await fs.readFile(manifest, "utf8");
    const pick = (key: string) => text.match(new RegExp(`"${key}"\\s+"([^\"]+)"`))?.[1];
    return {
      path: manifest,
      exists: true,
      stateFlags: pick("StateFlags"),
      installDir: pick("installdir"),
      lastUpdated: pick("LastUpdated"),
      buildId: pick("buildid")
    };
  } catch {
    return { path: manifest, exists: false };
  }
}
