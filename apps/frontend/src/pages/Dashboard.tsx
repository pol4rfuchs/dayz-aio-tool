import { Play, RefreshCcw, Square, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { StatusCard } from "../components/StatusCard";
import { apiGet, apiPost, getWebSocketUrl } from "../lib/api";
import type { AuditItem, BackupRecord, RuntimeStatus, ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };

export function Dashboard({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [statuses, setStatuses] = useState<RuntimeStatus[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState("");

  const selected = useMemo(() => servers.find((server) => server.id === selectedServerId), [servers, selectedServerId]);
  const status = statuses.find((item) => item.serverId === selectedServerId);

  async function load() {
    try {
      const serverRows = await apiGet<ServerRecord[]>("/api/servers");
      setServers(serverRows);
      if (!selectedServerId && serverRows[0]) setSelectedServerId(serverRows[0].id);
      const statusRows = await apiGet<{ items: RuntimeStatus[] }>("/api/servers/status");
      setStatuses(statusRows.items);
      const activeId = selectedServerId || serverRows[0]?.id;
      if (activeId) {
        setBackups(await apiGet<BackupRecord[]>(`/api/servers/${activeId}/backups`));
        setLogs((await apiGet<{ lines: string[] }>(`/api/servers/${activeId}/logs?limit=120`)).lines);
      }
      setAudit((await apiGet<{ items: AuditItem[] }>("/api/audit?limit=20")).items);
      setError("");
    } catch (err) { setError((err as Error).message); }
  }

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [selectedServerId]);
  useEffect(() => {
    const ws = new WebSocket(getWebSocketUrl());
    ws.onmessage = (event) => {
      const raw = JSON.parse(event.data);
      setEvents((prev) => [`${raw.createdAt} ${raw.type}`, ...prev].slice(0, 10));
      if (raw.type === "server.status") load();
      if (raw.type === "server.log" && raw.serverId === selectedServerId) setLogs((prev) => [...prev, raw.payload.line].slice(-120));
    };
    return () => ws.close();
  }, [selectedServerId]);

  async function action(kind: "start" | "stop" | "restart") {
    if (!selectedServerId) return;
    await apiPost(`/api/servers/${selectedServerId}/${kind}`);
    await load();
  }

  return (
    <div className="page">
      <section className="hero glass">
        <div><p className="eyebrow">Realtime Control Plane</p><h1>Dashboard</h1><p className="muted">Live-Status, Start/Stop, Logs, Backups und Audit in einem Panel.</p></div>
        <div className="actions"><ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId} /></div>
      </section>

      {error ? <div className="message error-box"><strong>Backend error</strong><p>{error}</p></div> : null}

      <section className="grid">
        <StatusCard label="Server" value={selected?.name ?? "none"} note={selected?.rootPath ?? "Add a server first"} />
        <StatusCard label="Status" value={status?.status ?? "unknown"} note={status?.pid ? `PID ${status.pid}` : "no process"} />
        <StatusCard label="Backups" value={backups.length} note={backups[0]?.createdAt ?? "no backups"} />
        <StatusCard label="Audit" value={audit.length} note="latest actions" />
      </section>

      <section className="panel glass">
        <div className="panel-title"><Zap size={20} /><h2>Quick actions</h2></div>
        <div className="actions">
          <button onClick={() => action("start")} disabled={!selectedServerId}><Play size={18} />Start</button>
          <button onClick={() => action("stop")} disabled={!selectedServerId} className="secondary"><Square size={18} />Stop</button>
          <button onClick={() => action("restart")} disabled={!selectedServerId} className="secondary"><RefreshCcw size={18} />Restart + Backup</button>
          <button onClick={load} className="secondary"><RefreshCcw size={18} />Refresh</button>
        </div>
      </section>

      <section className="two-column">
        <div className="panel glass"><h2>Live logs</h2><pre className="logbox">{logs.length ? logs.join("\n") : "No log lines captured yet."}</pre></div>
        <div className="panel glass"><h2>Realtime events</h2><div className="list compact">{events.map((e) => <div key={e}>{e}</div>)}</div><h2>Recent audit</h2><div className="list compact">{audit.map((item) => <div key={item.id}><strong>{item.action}</strong><span>{item.target}</span></div>)}</div></div>
      </section>
    </div>
  );
}
