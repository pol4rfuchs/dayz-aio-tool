import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { StatusCard } from "../components/StatusCard";
import { apiGet } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };
export function Analytics({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]); const [data, setData] = useState<any>(null); const [error, setError] = useState("");
  useEffect(() => { apiGet<ServerRecord[]>("/api/servers").then((s) => { setServers(s); if (!selectedServerId && s[0]) setSelectedServerId(s[0].id); }); }, []);
  async function load() { if (!selectedServerId) return; try { setData(await apiGet(`/api/servers/${selectedServerId}/analytics/summary`)); setError(""); } catch (e) { setError((e as Error).message); } }
  useEffect(() => { load(); }, [selectedServerId]);
  return <div className="page"><section className="hero glass"><div><p className="eyebrow">Observability</p><h1>Analytics</h1><p className="muted">MVP-Summary aus Status, Backups, Mods und Economy-Struktur.</p></div><ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/></section>{error && <div className="message error-box"><strong>Error</strong><p>{error}</p></div>}{data && <><section className="grid"><StatusCard label="Status" value={data.status.status} note={data.status.pid ? `PID ${data.status.pid}` : "no pid"}/><StatusCard label="Mods" value={data.mods}/><StatusCard label="Economy Items" value={data.economy.items}/><StatusCard label="Mission DB" value={`${Math.round(data.dbSize.size / 1024)} KB`} note={`${data.dbSize.files} files`}/></section><section className="panel glass"><div className="panel-title"><BarChart3 size={20}/><h2>Raw summary</h2></div><pre className="logbox">{JSON.stringify(data, null, 2)}</pre></section></>}</div>;
}
