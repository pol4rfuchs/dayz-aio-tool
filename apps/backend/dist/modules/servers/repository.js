import { getDb } from "../../db/database.js";
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
export function listServers() {
    return getDb().prepare(`${SELECT_SERVER} ORDER BY created_at DESC`).all();
}
export function getServer(id) {
    return getDb().prepare(`${SELECT_SERVER} WHERE id = ?`).get(id);
}
export function requireServer(id) {
    const server = getServer(id);
    if (!server)
        throw Object.assign(new Error("Server not found"), { statusCode: 404 });
    return server;
}
