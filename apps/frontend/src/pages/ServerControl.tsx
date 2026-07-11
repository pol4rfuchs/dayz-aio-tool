import { AlertTriangle, Clock, Copy, Network, Play, Power, RefreshCcw, Server, Square, Terminal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { StatusCard } from "../components/StatusCard";
import { apiGet, apiPost, getWebSocketUrl } from "../lib/api";
import type { RuntimeStatus, ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };

type PortStatus = {
  port: number;
  bound: boolean;
  checkedAt: string;
  lines: string[];
  note: string;
};

type ControlSummary = {
  serverId: string;
  server: ServerRecord;
  status: RuntimeStatus;
  configuredPort: number;
  port: PortStatus;
  launchCommand: string;
  generatedAt: string;
};

type StartPreflight = {
  ok: boolean;
  blockingFailures: number;
  recommendedAction: string;
  checks: Array<{ key: string; label: string; ok: boolean; path?: string; blocking?: boolean; message?: string }>;
};

function isRunning(status?: RuntimeStatus) {
  return status?.pidAlive || status?.status === "running" || status?.status === "running-external";
}

function formatUptime(status?: RuntimeStatus) {
  if (!status?.lastStartedAt || !isRunning(status)) return "not running";
  const started = new Date(status.lastStartedAt).getTime();
  if (!Number.isFinite(started)) return "unknown";
  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${m}m ${s}s`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function getPortLabel(summary?: ControlSummary) {
  if (!summary) return "unknown";
  if (summary.port.bound) return `bound :${summary.port.port}`;
  if (isRunning(summary.status)) return `not visible :${summary.port.port}`;
  return `idle :${summary.port.port}`;
}

export function ServerControl({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [summary, setSummary] = useState<ControlSummary | null>(null);
  const [preflight, setPreflight] = useState<StartPreflight | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const selected = useMemo(() => servers.find((server) => server.id === selectedServerId) ?? summary?.server ?? null, [servers, selectedServerId, summary]);
  const running = isRunning(summary?.status);

  async function load() {
    try {
      const serverRows = await apiGet<ServerRecord[]>("/api/servers");
      setServers(serverRows);
      const activeId = selectedServerId || serverRows[0]?.id || "";
      if (!selectedServerId && activeId) setSelectedServerId(activeId);
      if (activeId) {
        const nextSummary = await apiGet<ControlSummary>(`/api/servers/${activeId}/control`);
        setSummary(nextSummary);
        setPreflight(await apiGet<StartPreflight>(`/api/servers/${activeId}/start/preflight`));
        setLogs((await apiGet<{ lines: string[] }>(`/api/servers/${activeId}/logs?limit=180`)).lines);
      } else {
        setSummary(null);
        setPreflight(null);
        setLogs([]);
      }
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { void load(); const t = setInterval(() => void load(), 3000); return () => clearInterval(t); }, [selectedServerId]);

  useEffect(() => {
    const ws = new WebSocket(getWebSocketUrl());
    ws.onmessage = (event) => {
      const raw = JSON.parse(event.data);
      if (raw.type === "server.status") void load();
      if (raw.type === "server.log" && raw.serverId === selectedServerId) setLogs((prev) => [...prev, raw.payload.line].slice(-180));
    };
    return () => ws.close();
  }, [selectedServerId]);

  async function runAction(kind: "start" | "stop" | "restart", label: string) {
    if (!selectedServerId) return;
    setBusy(kind);
    setMessage("");
    setError("");
    try {
      await apiPost(`/api/servers/${selectedServerId}/${kind}`);
      setMessage(`${label} requested.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function forceStop() {
    if (!selectedServerId) return;
    if (!window.confirm("Force Stop / Kill Process ausführen? Das beendet den DayZServer-Prozess hart, falls er noch lebt.")) return;
    await runAction("stop", "Force stop");
  }

  async function copyLaunchCommand() {
    if (!summary?.launchCommand) return;
    await navigator.clipboard.writeText(summary.launchCommand);
    setMessage("Launch command copied to clipboard.");
  }

  return (
    <div className="page">
      <section className="hero glass compact-hero">
        <div>
          <p className="eyebrow">Runtime / Process Control</p>
          <h1>Server Control</h1>
          <p className="muted">Dedizierte Start/Stop/Restart-Seite mit PID, Uptime, Portstatus, Launch Preview und Prozesslog.</p>
        </div>
        <div className="actions"><ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId} /></div>
      </section>

      {error ? <div className="message error-box"><AlertTriangle size={20} /><div><strong>Server Control error</strong><p>{error}</p></div></div> : null}
      {message ? <div className="message success-box"><Power size={20} /><div><strong>Action result</strong><p>{message}</p></div></div> : null}
      {!selectedServerId ? <div className="message warning-box"><AlertTriangle size={20} /><div><strong>No server selected</strong><p>Add or select an existing DayZ server before using runtime controls.</p></div></div> : null}

      <section className="grid">
        <StatusCard label="Selected Server" value={selected?.name ?? "none"} note={selected?.rootPath ?? "No server selected"} />
        <StatusCard label="Runtime Status" value={summary?.status.status ?? "unknown"} note={summary?.status.pid ? `PID ${summary.status.pid}` : "no PID"} />
        <StatusCard label="Uptime" value={formatUptime(summary?.status)} note={summary?.status.lastStartedAt ?? "not started"} />
        <StatusCard label="Game Port" value={getPortLabel(summary ?? undefined)} note={summary?.port.note ?? "not checked"} />
      </section>

      <section className="panel glass">
        <div className="panel-title"><Power size={20} /><h2>Runtime actions</h2></div>
        <div className="actions">
          <button onClick={() => runAction("start", "Start")} disabled={!selectedServerId || running || Boolean(busy)}><Play size={18} />Start</button>
          <button onClick={() => runAction("stop", "Stop")} disabled={!selectedServerId || !running || Boolean(busy)} className="secondary"><Square size={18} />Stop</button>
          <button onClick={() => runAction("restart", "Restart + Backup")} disabled={!selectedServerId || Boolean(busy)} className="secondary"><RefreshCcw size={18} />Restart + Backup</button>
          <button onClick={forceStop} disabled={!selectedServerId || !running || Boolean(busy)} className="danger"><Power size={18} />Force Stop / Kill</button>
          <button onClick={load} disabled={Boolean(busy)} className="secondary"><RefreshCcw size={18} />Refresh</button>
        </div>
        {busy ? <p className="hint warning">Running action: {busy}</p> : null}
      </section>

      <section className="two-column wide-left">
        <div className="panel glass">
          <div className="panel-title"><Terminal size={20} /><h2>Launch Params Preview</h2></div>
          <p className="muted">This is the exact command AIO will use for Start. Use Copy when you want to test the same command manually in PowerShell.</p>
          <pre className="logbox small">{summary?.launchCommand ?? "No launch command available."}</pre>
          <div className="actions">
            <button onClick={copyLaunchCommand} disabled={!summary?.launchCommand} className="secondary"><Copy size={18} />Copy Launch Command</button>
          </div>
        </div>

        <div className="panel glass">
          <div className="panel-title"><Server size={20} /><h2>Process Details</h2></div>
          <div className="list compact">
            <div><strong>Status</strong><span>{summary?.status.status ?? "unknown"}</span></div>
            <div><strong>PID</strong><span>{summary?.status.pid ?? "none"}</span></div>
            <div><strong>PID alive</strong><span>{summary?.status.pidAlive ? "yes" : "no"}</span></div>
            <div><strong>Started</strong><span>{summary?.status.lastStartedAt ?? "never"}</span></div>
            <div><strong>Stopped</strong><span>{summary?.status.lastStoppedAt ?? "never"}</span></div>
            <div><strong>Log lines</strong><span>{summary?.status.logLines ?? 0}</span></div>
          </div>
        </div>
      </section>

      <section className="two-column">
        <div className="panel glass">
          <div className="panel-title"><Network size={20} /><h2>Port 2302 / configured game port</h2></div>
          <p className="muted">AIO checks the local socket table. DayZ uses UDP, so the port may only appear after the server is fully ready.</p>
          <div className="tag-row">
            <span className={summary?.port.bound ? "pill ok" : running ? "pill warn" : "pill muted"}>{summary?.port.bound ? "BOUND" : running ? "NOT VISIBLE YET" : "IDLE"}</span>
            <span className="pill muted">Port {summary?.configuredPort ?? 2302}</span>
            <span className="pill muted">Checked {summary?.port.checkedAt ?? "never"}</span>
          </div>
          <pre className="small-code">{summary?.port.lines.length ? summary.port.lines.join("\n") : summary?.port.note ?? "No port check yet."}</pre>
        </div>

        <div className="panel glass">
          <div className="panel-title"><Clock size={20} /><h2>Start Preflight</h2></div>
          <p className={preflight?.ok ? "ok" : "warning"}>{preflight?.recommendedAction ?? "No preflight result."}</p>
          <div className="checks">
            {(preflight?.checks ?? []).map((check) => (
              <div key={check.key} className="check-row">
                <span className={check.ok ? "ok" : check.blocking ? "bad" : "warning"}>{check.ok ? "✓" : check.blocking ? "✕" : "!"}</span>
                <div><strong>{check.label}</strong><span>{check.path || check.message || "-"}</span>{check.message ? <p>{check.message}</p> : null}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel glass">
        <div className="panel-title"><Terminal size={20} /><h2>Last Process Log</h2></div>
        <pre className="logbox">{logs.length ? logs.join("\n") : "No process log lines captured yet."}</pre>
      </section>
    </div>
  );
}
