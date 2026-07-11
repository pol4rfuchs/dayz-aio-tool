import { MessageSquare, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiGet, apiPost } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };

type MessageItem = { text: string; deadline: number; shutdown: boolean };

export function CommunityOps({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [out, setOut] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([
    { text: "Welcome to the server. Respect the rules and have fun.", deadline: 15, shutdown: false },
    { text: "Restart warning: server restart in 10 minutes.", deadline: 10, shutdown: false }
  ]);
  useEffect(() => { apiGet<ServerRecord[]>("/api/servers").then((s) => { setServers(s); if (!selectedServerId && s[0]) setSelectedServerId(s[0].id); }); }, []);
  async function run(fn: () => Promise<unknown>) { try { setOut(JSON.stringify(await fn(), null, 2)); } catch (e) { setOut((e as Error).message); } }
  function updateMessage(index: number, patch: Partial<MessageItem>) { setMessages((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  return <div className="page"><section className="hero glass"><div><p className="eyebrow">Community / Ops</p><h1>Community Ops</h1><p className="muted">Kleine Community-Helfer: DZSA-Erkennung und messages.xml Generator.</p></div><ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/></section><section className="two-column"><div className="panel glass form"><div className="panel-title"><ShieldCheck size={20}/><h2>DZSA Launcher readiness</h2></div><p className="muted">Prüft, ob ein DZSALModServer-Kandidat im Server-Root liegt.</p><button onClick={() => run(() => apiGet(`/api/servers/${selectedServerId}/community/dzsa-check`))} disabled={!selectedServerId}>DZSALModServer check</button><hr/><div className="panel-title"><MessageSquare size={20}/><h2>Messages generator</h2></div>{messages.map((message, index) => <div key={index} className="form mini-card"><label><span>Text</span><input value={message.text} onChange={(e) => updateMessage(index, { text: e.target.value })}/></label><label><span>Deadline / minutes</span><input type="number" value={message.deadline} onChange={(e) => updateMessage(index, { deadline: Number(e.target.value) })}/></label><label className="check-row"><input type="checkbox" checked={message.shutdown} onChange={(e) => updateMessage(index, { shutdown: e.target.checked })}/><span>Shutdown message</span></label></div>)}<div className="actions"><button className="secondary" onClick={() => setMessages((items) => [...items, { text: "New server message", deadline: 15, shutdown: false }])}>Add message</button><button onClick={() => run(() => apiPost(`/api/servers/${selectedServerId}/community/messages`, { items: messages, save: false }))} disabled={!selectedServerId}>Preview XML</button><button className="danger" onClick={() => run(() => apiPost(`/api/servers/${selectedServerId}/community/messages`, { items: messages, save: true }))} disabled={!selectedServerId}>Save messages.xml</button></div></div><div className="panel glass"><h2>Output</h2><pre className="logbox">{out || "No community output yet."}</pre></div></section></div>;
}
