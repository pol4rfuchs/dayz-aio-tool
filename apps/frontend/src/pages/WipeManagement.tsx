import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiGet, apiPost } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };
export function WipeManagement({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [out, setOut] = useState("");
  const [seasonName, setSeasonName] = useState(`Season ${new Date().getFullYear()}`);
  const [storageName, setStorageName] = useState("storage_1");
  const [confirm, setConfirm] = useState("");
  useEffect(() => { apiGet<ServerRecord[]>("/api/servers").then((s) => { setServers(s); if (!selectedServerId && s[0]) setSelectedServerId(s[0].id); }); }, []);
  async function run(fn: () => Promise<unknown>) { try { setOut(JSON.stringify(await fn(), null, 2)); } catch (e) { setOut((e as Error).message); } }
  return <div className="page"><section className="hero glass"><div><p className="eyebrow">Persistence</p><h1>Wipe Management</h1><p className="muted">Sicherer Storage-Wipe: active storage_N wird archiviert, nicht gelöscht. Server vorher stoppen.</p></div><ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/></section><section className="two-column"><div className="panel glass form"><div className="panel-title"><Trash2 size={20}/><h2>Wipe cycle</h2></div><button onClick={() => run(() => apiGet(`/api/servers/${selectedServerId}/wipe/plan`))} disabled={!selectedServerId}>Load wipe plan</button><label><span>Season / wipe name</span><input value={seasonName} onChange={(e) => setSeasonName(e.target.value)}/></label><label><span>Storage folder</span><input value={storageName} onChange={(e) => setStorageName(e.target.value)}/></label><label><span>Confirm token</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="WIPE_STORAGE"/></label><button className="danger" onClick={() => run(() => apiPost(`/api/servers/${selectedServerId}/wipe/execute`, { seasonName, storageName, confirm }))} disabled={!selectedServerId || confirm !== "WIPE_STORAGE"}>Archive storage and start new wipe</button></div><div className="panel glass"><h2>Output</h2><pre className="logbox">{out || "No wipe output yet."}</pre></div></section></div>;
}
