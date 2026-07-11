import { Archive, Download, FileWarning, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { API_BASE, apiGet, downloadApiFile } from "../lib/api";

type DebugStatus = {
  ok: boolean;
  version: string;
  logDir: string;
  snapshotDir: string;
  backendLogFile: string;
  createdAt: string;
};

export function DebugBundle() {
  const [status, setStatus] = useState<DebugStatus>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadStatus() {
    setMessage("");
    try {
      setStatus(await apiGet<DebugStatus>("/api/debug/status"));
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function exportBundle() {
    setBusy(true);
    setMessage("Export läuft...");
    try {
      await downloadApiFile("/api/debug/bundle");
      setMessage("Debug Bundle wurde erzeugt und heruntergeladen.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="hero glass">
        <div>
          <p className="eyebrow">Support / Diagnose</p>
          <h1>Debug Bundle</h1>
          <p>Exportiert Logs, Doctor-/Readiness-Snapshots und maskierte Konfiguration als ZIP.</p>
        </div>
        <Archive size={42} />
      </section>

      <div className="grid two">
        <div className="panel glass">
          <div className="panel-title"><ShieldCheck size={20} /><h2>Secret-Schutz</h2></div>
          <p className="muted">Das Bundle enthält keine rohe SQLite-DB und maskiert API-Key, Secret-Key, RCON-Passwörter und Query-Token in Textlogs.</p>
          <div className="message warning-box"><FileWarning size={18}/><div><strong>Trotzdem prüfen</strong><p>Bei Reverse-Proxy-/Custom-Logs vor Weitergabe kurz prüfen, ob externe Tools eigene Secrets geschrieben haben.</p></div></div>
          <button className="primary" onClick={exportBundle} disabled={busy}><Download size={18}/>{busy ? "Export läuft..." : "Export Debug Bundle"}</button>
        </div>

        <div className="panel glass">
          <div className="panel-title"><Archive size={20}/><h2>Debug Status</h2></div>
          <button onClick={loadStatus}>Status laden</button>
          {status ? <pre className="mini-pre">{JSON.stringify(status, null, 2)}</pre> : <p className="muted">Noch nicht geladen.</p>}
          <p className="muted">API: {API_BASE}/api/debug/bundle</p>
        </div>
      </div>

      {message ? <div className="panel glass"><pre className="mini-pre">{message}</pre></div> : null}
    </div>
  );
}
