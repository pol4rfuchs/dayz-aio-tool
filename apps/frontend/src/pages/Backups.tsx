import { HardDrive, RefreshCcw, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiDelete, apiGet, apiGetOrNull, apiPost } from "../lib/api";
import type { BackupRecord, ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };

export function Backups({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [items, setItems] = useState<BackupRecord[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadServers() {
    const nextServers = await apiGet<ServerRecord[]>("/api/servers");
    setServers(nextServers);
    if (selectedServerId && !nextServers.some((server) => server.id === selectedServerId)) {
      const fallback = nextServers[0]?.id ?? "";
      setSelectedServerId(fallback);
      setItems([]);
      setMessage(fallback ? "Previous server selection was stale. Switched to the first available server." : "No server configured yet.");
      return fallback;
    }
    if (!selectedServerId && nextServers[0]) {
      setSelectedServerId(nextServers[0].id);
      return nextServers[0].id;
    }
    return selectedServerId;
  }

  async function load() {
    setLoading(true);
    try {
      setMessage("");
      const serverId = await loadServers();
      if (!serverId) {
        setItems([]);
        setMessage("No server selected. Add or select a server first.");
        return;
      }
      const backups = await apiGetOrNull<BackupRecord[]>(`/api/servers/${serverId}/backups`, [404]);
      if (backups === null) {
        setItems([]);
        setMessage("No backups yet, or the previous server selection no longer exists. Create a manual backup after selecting a valid server.");
        return;
      }
      setItems(backups);
      if (backups.length === 0) setMessage("No backups yet. Create a manual backup before heavier tests.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [selectedServerId]);

  async function create() {
    if (!selectedServerId) return;
    await apiPost(`/api/servers/${selectedServerId}/backups`);
    await load();
  }

  async function restore(id: string) {
    if (!selectedServerId) return;
    await apiPost(`/api/servers/${selectedServerId}/backups/${id}/restore`);
    setMessage("Restore completed.");
  }

  async function remove(id: string) {
    if (!selectedServerId) return;
    await apiDelete(`/api/servers/${selectedServerId}/backups/${id}`);
    await load();
  }

  return (
    <div className="page">
      <section className="hero glass">
        <div>
          <p className="eyebrow">Recovery</p>
          <h1>Backup Timeline</h1>
          <p className="muted">Manuelle Backups, automatische Safety-Backups, Restore und Delete.</p>
        </div>
        <ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId} />
      </section>
      <section className="panel glass">
        <div className="actions">
          <button onClick={create} disabled={!selectedServerId || loading}><HardDrive size={18} />Create manual backup</button>
          <button className="secondary" onClick={load} disabled={loading}><RefreshCcw size={18} />Refresh</button>
        </div>
        {message && <p className="hint">{message}</p>}
        {items.length === 0 ? <div className="empty-state">No backup records to show yet.</div> : null}
        <div className="timeline">
          {items.map((item) => (
            <article className="timeline-item" key={item.id}>
              <div>
                <strong>{item.type}</strong><span>{item.createdAt}</span><p>{item.reason}</p><small>{item.path}</small>
              </div>
              <div className="actions"><button className="secondary" onClick={() => restore(item.id)}><RotateCcw size={16} />Restore</button><button className="danger" onClick={() => remove(item.id)}><Trash2 size={16} />Delete</button></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
