import { FileText, RefreshCcw, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiGet } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };
type LogFile = { path: string; name: string; size: number; modifiedAt: string };

export function LiveLogs({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [runtime, setRuntime] = useState<string[]>([]);
  const [files, setFiles] = useState<LogFile[]>([]);
  const [tail, setTail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { apiGet<ServerRecord[]>("/api/servers").then((s) => { setServers(s); if (!selectedServerId && s[0]) setSelectedServerId(s[0].id); }); }, []);

  async function refresh() {
    if (!selectedServerId) return;
    const result = await apiGet<{ runtime: string[]; files: LogFile[] }>(`/api/servers/${selectedServerId}/live-logs`);
    setRuntime(result.runtime || []);
    setFiles(result.files || []);
    setMessage(`Loaded ${result.runtime?.length ?? 0} runtime lines and ${result.files?.length ?? 0} log files.`);
  }

  async function openFile(file: string) {
    const result = await apiGet<{ tail: string }>(`/api/servers/${selectedServerId}/live-logs/file?path=${encodeURIComponent(file)}&bytes=60000`);
    setTail(result.tail);
  }

  useEffect(() => { refresh().catch(() => undefined); const timer = setInterval(() => refresh().catch(() => undefined), 5000); return () => clearInterval(timer); }, [selectedServerId]);

  return <div className="page">
    <section className="hero glass compact-hero">
      <div><p className="eyebrow">Runtime Observability</p><h1>Live Logs</h1><p className="muted">Runtime buffer, latest RPT/script/admin/crash log discovery and one-click tail.</p></div>
      <ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/>
    </section>

    <section className="two-column wide-left">
      <div className="panel glass">
        <div className="panel-title"><Terminal size={20}/><h2>Runtime Buffer</h2></div>
        <div className="actions"><button onClick={refresh} disabled={!selectedServerId}><RefreshCcw size={18}/>Refresh</button></div>
        {message ? <p className="hint">{message}</p> : null}
        <pre className="logbox">{runtime.length ? runtime.join("\n") : "No runtime lines captured yet. Start the server from AIO to fill this buffer."}</pre>
      </div>

      <div className="panel glass">
        <div className="panel-title"><FileText size={20}/><h2>Latest Log Files</h2></div>
        <div className="table-wrap"><table><thead><tr><th>File</th><th>Modified</th><th>Size</th></tr></thead><tbody>{files.map((file) => <tr key={file.path} onClick={() => openFile(file.path)}><td>{file.name}</td><td>{new Date(file.modifiedAt).toLocaleString()}</td><td>{file.size}</td></tr>)}</tbody></table></div>
      </div>
    </section>

    <section className="panel glass">
      <div className="panel-title"><FileText size={20}/><h2>Selected File Tail</h2></div>
      <pre className="logbox">{tail || "Click a log file to load the latest tail."}</pre>
    </section>
  </div>;
}
