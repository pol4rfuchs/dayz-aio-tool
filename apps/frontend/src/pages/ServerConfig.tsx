import { FileText, Rocket, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiGet, apiPost, apiPut } from "../lib/api";
import type { DiffLine, ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };
type LaunchImportResponse = { ok: boolean; server: ServerRecord; detection: { recommendedLaunchParams: string; source?: { filePath: string; confidence: string; modCount?: number; serverModCount?: number; hints?: string[] }; warnings: string[]; errors: string[]; managerMods?: string[]; managerServerMods?: string[] } };

export function ServerConfig({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [server, setServer] = useState<ServerRecord | null>(null);
  const [content, setContent] = useState("");
  const [diff, setDiff] = useState<DiffLine[]>([]);
  const [message, setMessage] = useState("");
  const [launchImport, setLaunchImport] = useState<LaunchImportResponse | null>(null);

  useEffect(() => {
    apiGet<ServerRecord[]>("/api/servers").then((s) => {
      setServers(s);
      if (!selectedServerId && s[0]) setSelectedServerId(s[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedServerId) return;
    apiGet<ServerRecord>(`/api/servers/${selectedServerId}`).then(setServer).catch((e) => setMessage(e.message));
    apiGet<{ content: string }>(`/api/servers/${selectedServerId}/config/serverdz`).then((r) => setContent(r.content)).catch((e) => setMessage(e.message));
  }, [selectedServerId]);

  async function save() {
    const r = await apiPut<{ ok: boolean }>(`/api/servers/${selectedServerId}/config/serverdz`, { content });
    setMessage(r.ok ? "Saved with backup." : "Save failed");
  }

  async function makeDiff() {
    setDiff((await apiPost<{ diff: DiffLine[] }>(`/api/servers/${selectedServerId}/config/serverdz/diff`, { content })).diff);
  }

  async function importLaunchProfile() {
    setMessage("");
    const result = await apiPost<LaunchImportResponse>(`/api/servers/${selectedServerId}/launch-profile/import`, {});
    setLaunchImport(result);
    setServer(result.server);
    setServers((prev) => prev.map((item) => item.id === result.server.id ? result.server : item));
    setMessage(result.ok ? "Launch profile imported." : "Launch profile import failed.");
  }

  return <div className="page">
    <section className="hero glass">
      <div><p className="eyebrow">Config</p><h1>serverDZ.cfg</h1><p className="muted">Raw Editor mit Validation, Diff, Backup-before-save und Launch Profile Import.</p></div>
      <ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/>
    </section>
    <section className="two-column wide-left">
      <div className="panel glass">
        <div className="panel-title"><FileText size={20}/><h2>Editor</h2></div>
        <textarea className="code-editor" value={content} onChange={(e) => setContent(e.target.value)} />
        <div className="actions"><button onClick={makeDiff} disabled={!selectedServerId}>Diff Preview</button><button onClick={save} disabled={!selectedServerId}><Save size={18}/>Save</button></div>
        {message && <p className="hint">{message}</p>}
      </div>
      <div className="panel glass">
        <h2>Launch Profile</h2>
        <p className="muted">Importiert alte DayZ Server Manager Profile aus <code>server-manager.json</code>, <code>baseserver-manager.json</code> und <code>Server_manager.ps1</code>.</p>
        <pre className="small-code">{server?.launchParams || "No launch params loaded."}</pre>
        <div className="actions"><button onClick={importLaunchProfile} disabled={!selectedServerId}><Rocket size={18}/>Import old manager profile</button></div>
        {launchImport ? <div className="launch-profile-box">
          <p className="hint">Quelle: {launchImport.detection.source?.filePath || "generated fallback"}</p>
          <div className="tag-row">
            <span className="pill ok">WS mods {launchImport.detection.managerMods?.length ?? launchImport.detection.source?.modCount ?? 0}</span>
            <span className="pill ok">WS servermods {launchImport.detection.managerServerMods?.length ?? launchImport.detection.source?.serverModCount ?? 0}</span>
            <span className="pill muted">Confidence {launchImport.detection.source?.confidence || "n/a"}</span>
          </div>
          <pre className="small-code">{launchImport.detection.recommendedLaunchParams}</pre>
          {launchImport.detection.warnings.length ? <div className="message warning-box"><div><strong>Warnings</strong>{launchImport.detection.warnings.map((w) => <p key={w}>{w}</p>)}</div></div> : null}
          {launchImport.detection.errors.length ? <div className="message error-box"><div><strong>Errors</strong>{launchImport.detection.errors.map((w) => <p key={w}>{w}</p>)}</div></div> : null}
        </div> : null}
        <h2>Diff</h2>
        <pre className="diffbox">{diff.map((line, i) => `${line.type === "add" ? "+" : line.type === "remove" ? "-" : " "} ${line.line}`).join("\n") || "No diff generated."}</pre>
      </div>
    </section>
  </div>;
}
