import { getDb } from "../../db/database.js";

export type ServerRecord = {
  id: string;
  name: string;
  rootPath: string;
  profilePath: string;
  executablePath: string;
  missionPath: string;
  launchParams: string;
  rconHost?: string | null;
  rconPort?: number | null;
  rconPassword?: string | null;
  steamcmdPath?: string | null;
  workshopAppId: string;
  createdAt: string;
  updatedAt: string;
};

export const SELECT_SERVER = `
  SELECT
    id,
    name,
    root_path as rootPath,
    profile_path as profilePath,
    executable_path as executablePath,
    mission_path as missionPath,
    launch_params as launchParams,
    rcon_host as rconHost,
    rcon_port as rconPort,
    rcon_password as rconPassword,
    steamcmd_path as steamcmdPath,
    workshop_app_id as workshopAppId,
    created_at as createdAt,
    updated_at as updatedAt
  FROM servers
`;

export function listServers(): ServerRecord[] {
  return getDb().prepare(`${SELECT_SERVER} ORDER BY created_at DESC`).all() as ServerRecord[];
}

export function getServer(id: string): ServerRecord | undefined {
  return getDb().prepare(`${SELECT_SERVER} WHERE id = ?`).get(id) as ServerRecord | undefined;
}

export function requireServer(id: string): ServerRecord {
  const server = getServer(id);
  if (!server) throw Object.assign(new Error("Server not found"), { statusCode: 404 });
  return server;
}
