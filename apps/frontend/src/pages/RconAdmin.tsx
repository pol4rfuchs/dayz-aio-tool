import { Radio, Send, UserMinus, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiGet, apiPost } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };
export function RconAdmin({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [command, setCommand] = useState("players");
  const [message, setMessage] = useState("Server restart soon");
  const [playerId, setPlayerId] = useState("");
  const [reason, setReason] = useState("Admin action");
  const [result, setResult] = useState("");
  useEffect(() => { apiGet<ServerRecord[]>("/api/servers").then((s) => { setServers(s); if (!selectedServerId && s[0]) setSelectedServerId(s[0].id); }); }, []);
  async function call(fn: () => Promise<unknown>) { try { setResult(JSON.stringify(await fn(), null, 2)); } catch (e) { setResult((e as Error).message); } }
  return <div className="page"><section className="hero glass"><div><p className="eyebrow">Admin</p><h1>RCON / Player Admin</h1><p className="muted">BattlEye RCON ist guarded: echte Commands erst mit DAYZ_AIO_BATTLEYE_RCON_ENABLED=true. Erst Testserver nutzen.</p></div><ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/></section><section className="two-column"><div className="panel glass form"><div className="panel-title"><Radio size={20}/><h2>Commands</h2></div><div className="actions"><button onClick={() => call(() => apiPost(`/api/servers/${selectedServerId}/rcon/test`))} disabled={!selectedServerId}>Test UDP reachability</button><button onClick={() => call(() => apiGet(`/api/servers/${selectedServerId}/rcon/players`))} disabled={!selectedServerId}>Players</button></div><select value={command} onChange={(e) => setCommand(e.target.value)}><option>players</option><option>missions</option><option>say Server restart soon</option><option>restart</option><option>shutdown</option></select><button onClick={() => call(() => apiPost(`/api/servers/${selectedServerId}/rcon/command`, { command }))} disabled={!selectedServerId}><Send size={18}/>Send guarded command</button><hr/><label><span>Broadcast message</span><input value={message} onChange={(e) => setMessage(e.target.value)} /></label><button onClick={() => call(() => apiPost(`/api/servers/${selectedServerId}/rcon/broadcast`, { message }))} disabled={!selectedServerId || !message}><Volume2 size={18}/>Broadcast</button><label><span>Player ID / BE ID</span><input value={playerId} onChange={(e) => setPlayerId(e.target.value)} placeholder="ID from players output" /></label><label><span>Reason</span><input value={reason} onChange={(e) => setReason(e.target.value)} /></label><div className="actions"><button className="secondary" onClick={() => call(() => apiPost(`/api/servers/${selectedServerId}/rcon/kick`, { playerId, reason }))} disabled={!selectedServerId || !playerId}><UserMinus size={18}/>Kick</button><button className="danger" onClick={() => call(() => apiPost(`/api/servers/${selectedServerId}/rcon/ban`, { playerId, reason }))} disabled={!selectedServerId || !playerId}>Ban</button></div></div><div className="panel glass"><h2>Result</h2><pre className="logbox">{result || "No RCON result yet."}</pre></div></section></div>;
}
