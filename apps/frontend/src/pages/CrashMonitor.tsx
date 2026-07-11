import { AlertTriangle, Archive, FileSearch, RefreshCcw, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiGet, apiPost } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };
type CrashFile = { path: string; name: string; size: number; modifiedAt: string };
type Classification = { severity: "ok" | "warn" | "fail"; category: string; confidence: string; evidence: string[]; recommendedActions: string[]; entities: string[] };
type PersistenceScan = { missionPath: string; running: boolean; candidates: Array<{ name: string; path: string; files: number; bytes: number; modifiedAt: string }>; quarantines: Array<{ name: string; path: string; files: number; bytes: number; modifiedAt: string }>; warnings: string[] };

export function CrashMonitor({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [files, setFiles] = useState<CrashFile[]>([]);
  const [runtimeHits, setRuntimeHits] = useState<string[]>([]);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [persistence, setPersistence] = useState<PersistenceScan | null>(null);
  const [tail, setTail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { apiGet<ServerRecord[]>("/api/servers").then((s) => { setServers(s); if (!selectedServerId && s[0]) setSelectedServerId(s[0].id); }); }, []);

  async function scan() {
    if (!selectedServerId) return;
    const r = await apiGet<any>(`/api/servers/${selectedServerId}/crash/scan`);
    setFiles(r.files || []);
    setRuntimeHits(r.runtimeHits || []);
    setClassification(r.classification || null);
    setMessage(`${r.severity}: ${r.files?.length ?? 0} files, ${r.runtimeHits?.length ?? 0} runtime hits · ${r.classification?.category ?? "unclassified"}`);
  }

  async function openFile(path: string) {
    const result = await apiGet<any>(`/api/servers/${selectedServerId}/crash/file?path=${encodeURIComponent(path)}`);
    setTail(result.tail);
    if (result.classification) setClassification(result.classification);
  }

  async function scanPersistence() {
    if (!selectedServerId) return;
    setPersistence(await apiGet<PersistenceScan>(`/api/servers/${selectedServerId}/persistence/scan`));
  }

  async function quarantine(storageName = "storage_1") {
    if (!selectedServerId) return;
    if (!window.confirm(`Quarantine ${storageName}? Server must be stopped. A copy and a disabled folder will be created.`)) return;
    const result = await apiPost<any>(`/api/servers/${selectedServerId}/persistence/quarantine`, { storageName });
    setMessage(result.message || "Persistence storage quarantined.");
    await scanPersistence();
  }

  async function restore(path: string) {
    if (!selectedServerId) return;
    if (!window.confirm("Restore this quarantine copy to active storage_N? Active storage must not exist.")) return;
    const result = await apiPost<any>(`/api/servers/${selectedServerId}/persistence/restore`, { quarantinePath: path });
    setMessage(`Restored: ${result.restored}`);
    await scanPersistence();
  }

  const className = classification?.severity === "fail" ? "message error-box" : classification?.severity === "warn" ? "message warning-box" : "message success-box";

  return <div className="page">
    <section className="hero glass compact-hero"><div><p className="eyebrow">Reliability</p><h1>Crash Intelligence</h1><p className="muted">RPT-/Crashlog-Klassifizierung plus sichere Persistence-Quarantine-Tools.</p></div><ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/></section>

    <section className="two-column">
      <div className="panel glass">
        <div className="panel-title"><AlertTriangle size={20}/><h2>Crash Scan</h2></div>
        <button onClick={scan} disabled={!selectedServerId}><RefreshCcw size={18}/>Scan crash files</button>{message && <p className="hint">{message}</p>}
        {classification ? <div className={className}><ShieldAlert size={20}/><div><strong>{classification.category} · {classification.confidence}</strong><p>Severity: {classification.severity}</p>{classification.entities.length ? <p>Entities: {classification.entities.slice(0, 12).join(", ")}</p> : null}</div></div> : null}
        {classification?.recommendedActions.length ? <div className="timeline">{classification.recommendedActions.map((action, index) => <article className="timeline-item" key={index}><div><strong>Recommended action</strong><span>{action}</span></div></article>)}</div> : null}
        <div className="table-wrap"><table><thead><tr><th>File</th><th>Modified</th><th>Size</th></tr></thead><tbody>{files.map((f) => <tr key={f.path} onClick={() => openFile(f.path)}><td>{f.name}</td><td>{new Date(f.modifiedAt).toLocaleString()}</td><td>{f.size}</td></tr>)}</tbody></table></div>
        <h3>Runtime hits</h3><pre className="logbox small">{runtimeHits.join("\n") || "No runtime crash-like lines."}</pre>
      </div>
      <div className="panel glass"><div className="panel-title"><FileSearch size={20}/><h2>File Tail</h2></div><pre className="logbox">{tail || "Click a crash/log file."}</pre></div>
    </section>

    <section className="panel glass">
      <div className="panel-title"><Archive size={20}/><h2>Persistence Tools</h2></div>
      <p className="muted">Für OnStoreLoad/korrupten Entity-State: erst scannen, dann storage_1 nur bei gestopptem Server quarantänen. Es wird kopiert und umbenannt, nicht gelöscht.</p>
      <div className="actions"><button className="secondary" onClick={scanPersistence} disabled={!selectedServerId}><RefreshCcw size={18}/>Scan persistence</button><button className="danger" onClick={() => quarantine("storage_1")} disabled={!selectedServerId || persistence?.running}>Quarantine storage_1</button></div>
      {persistence?.warnings?.map((warning) => <p className="hint warning" key={warning}>{warning}</p>)}
      {persistence ? <div className="two-column">
        <div><h3>Active storage</h3><div className="timeline">{persistence.candidates.map((item) => <article className="timeline-item" key={item.path}><div><strong>{item.name}</strong><span>{item.files} files · {Math.round(item.bytes / 1024)} KB · {new Date(item.modifiedAt).toLocaleString()}</span></div><button className="danger" onClick={() => quarantine(item.name)} disabled={persistence.running}>Quarantine</button></article>)}{!persistence.candidates.length ? <p className="muted">No active storage_N folders found.</p> : null}</div></div>
        <div><h3>Quarantines</h3><div className="timeline">{persistence.quarantines.map((item) => <article className="timeline-item" key={item.path}><div><strong>{item.name}</strong><span>{item.files} files · {new Date(item.modifiedAt).toLocaleString()}</span></div><button className="secondary" onClick={() => restore(item.path)} disabled={persistence.running}>Restore copy</button></article>)}{!persistence.quarantines.length ? <p className="muted">No quarantines yet.</p> : null}</div></div>
      </div> : null}
    </section>
  </div>;
}
