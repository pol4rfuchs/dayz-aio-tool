import type { ServerRecord } from "../lib/types";

export function ServerSelect({ servers, serverId, onChange }: { servers: ServerRecord[]; serverId: string; onChange: (serverId: string) => void }) {
  return (
    <label className="inline-control">
      <span>Server</span>
      <select value={serverId} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select server</option>
        {servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}
      </select>
    </label>
  );
}
