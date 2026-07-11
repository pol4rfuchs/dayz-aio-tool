import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiGet } from "../lib/api";
import type { AuditItem, ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };
export function AuditLog({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]); const [items, setItems] = useState<AuditItem[]>([]);
  useEffect(() => { apiGet<ServerRecord[]>("/api/servers").then((s) => { setServers(s); if (!selectedServerId && s[0]) setSelectedServerId(s[0].id); }); }, []);
  async function load() { const qs = selectedServerId ? `?serverId=${selectedServerId}&limit=200` : "?limit=200"; setItems((await apiGet<{ items: AuditItem[] }>(`/api/audit${qs}`)).items); }
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [selectedServerId]);
  return <div className="page"><section className="hero glass"><div><p className="eyebrow">Traceability</p><h1>Audit Log</h1><p className="muted">Wer/was hat Config, Backups, Mods, Scheduler oder RCON angefasst?</p></div><ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/></section><section className="panel glass"><div className="panel-title"><ShieldCheck size={20}/><h2>Latest actions</h2></div><div className="timeline">{items.map((item) => <article className="timeline-item" key={item.id}><div><strong>{item.action}</strong><span>{item.createdAt}</span><p>{item.target}</p><small>{JSON.stringify(item.metadata)?.slice(0, 500)}</small></div></article>)}</div></section></div>;
}
