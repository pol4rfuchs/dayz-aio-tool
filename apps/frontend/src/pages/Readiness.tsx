import { Activity, CheckCircle2, CircleAlert, Rocket, ShieldCheck, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiGet } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };
type ReadinessCheck = { key: string; label: string; status: "pass" | "warn" | "fail"; message: string; path?: string; requiredFor?: string[] };
type ReadinessResult = { scope: string; ready: boolean; percentage: number; pass: number; warn: number; fail: number; createdAt: string; serverName?: string; nextActions?: Array<{ key: string; label: string; message: string }>; checks: ReadinessCheck[] };

function statusIcon(status: ReadinessCheck["status"]) {
  if (status === "pass") return <CheckCircle2 size={18} className="ok" />;
  if (status === "warn") return <CircleAlert size={18} className="warning" />;
  return <CircleAlert size={18} className="bad" />;
}

function ReadinessPanel({ title, result }: { title: string; result?: ReadinessResult }) {
  if (!result) return <div className="panel glass"><h2>{title}</h2><p className="muted">Noch nicht geladen.</p></div>;
  return (
    <div className="panel glass">
      <div className="panel-title"><Stethoscope size={20}/><h2>{title}</h2></div>
      <div className={result.ready ? "message success-box" : result.fail ? "message error-box" : "message warning-box"}>
        <Activity size={18}/>
        <div>
          <strong>{result.ready ? "Ready" : result.fail ? "Blocked" : "Needs attention"} · {result.percentage}%</strong>
          <p>{result.pass} OK · {result.warn} Warn · {result.fail} Fail · {new Date(result.createdAt).toLocaleString()}</p>
          <div className="progress"><span style={{ width: `${result.percentage}%` }} /></div>
        </div>
      </div>
      {result.nextActions?.length ? <div className="message warning-box"><Rocket size={18}/><div><strong>Nächste Aktionen</strong>{result.nextActions.map((item) => <p key={item.key}>{item.label}: {item.message}</p>)}</div></div> : null}
      <div className="checks doctor-checks">
        {result.checks.map((check) => (
          <div className={`check-row doctor-${check.status}`} key={check.key}>
            {statusIcon(check.status)}
            <div>
              <strong>{check.label}</strong>
              {check.path ? <span>{check.path}</span> : null}
              <p>{check.message}</p>
              {check.requiredFor?.length ? <small className="muted">Relevant für: {check.requiredFor.join(", ")}</small> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Readiness({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [system, setSystem] = useState<ReadinessResult>();
  const [server, setServer] = useState<ReadinessResult>();
  const [message, setMessage] = useState("");

  async function loadServers() {
    const rows = await apiGet<ServerRecord[]>("/api/servers");
    setServers(rows);
    if (!selectedServerId && rows[0]) setSelectedServerId(rows[0].id);
  }

  async function loadSystem() {
    try { setSystem(await apiGet<ReadinessResult>("/api/system/readiness")); }
    catch (e) { setMessage((e as Error).message); }
  }

  async function loadServer() {
    if (!selectedServerId) return;
    try { setServer(await apiGet<ReadinessResult>(`/api/servers/${selectedServerId}/readiness`)); }
    catch (e) { setMessage((e as Error).message); }
  }

  useEffect(() => { loadServers(); loadSystem(); }, []);
  useEffect(() => { loadServer(); }, [selectedServerId]);

  return (
    <div className="page">
      <section className="hero glass">
        <div>
          <p className="eyebrow">v0.2.20 Readiness</p>
          <h1>Go-Live Checklist</h1>
          <p className="muted">Zeigt blockierende Punkte vor Start, Save, Backup/Restore und Economy-Bearbeitung. Erst hier grün werden, dann Start/Stop testen.</p>
        </div>
        <div className="actions">
          <ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/>
          <button onClick={() => { loadSystem(); loadServer(); }}><ShieldCheck size={18}/>Refresh</button>
        </div>
      </section>
      {message ? <div className="message error-box"><CircleAlert size={18}/><div><strong>Fehler</strong><p>{message}</p></div></div> : null}
      <section className="two-column">
        <ReadinessPanel title="System Readiness" result={system}/>
        <ReadinessPanel title={server?.serverName ? `Server Readiness · ${server.serverName}` : "Server Readiness"} result={server}/>
      </section>
    </div>
  );
}
