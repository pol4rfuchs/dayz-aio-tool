import { Bot, Database, Map } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiGet, apiPost } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };
export function AdvancedLab({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [out, setOut] = useState("");
  const [question, setQuestion] = useState("Warum läuft mein Server schlecht?");
  const [category, setCategory] = useState("food");
  const [multiplier, setMultiplier] = useState(1.2);
  const [confirm, setConfirm] = useState("");
  useEffect(() => { apiGet<ServerRecord[]>("/api/servers").then((s) => { setServers(s); if (!selectedServerId && s[0]) setSelectedServerId(s[0].id); }); }, []);
  async function dyn() { setOut(JSON.stringify(await apiGet(`/api/servers/${selectedServerId}/dynamic-economy/plan`), null, 2)); }
  async function preview() { setOut(JSON.stringify(await apiPost(`/api/servers/${selectedServerId}/dynamic-economy/preview`, { category, multiplier, dryRun: true }), null, 2)); }
  async function apply() { setOut(JSON.stringify(await apiPost(`/api/servers/${selectedServerId}/dynamic-economy/apply`, { category, multiplier, confirm }), null, 2)); }
  async function map() { setOut(JSON.stringify(await apiGet(`/api/servers/${selectedServerId}/map-tools`), null, 2)); }
  async function ai() { setOut(JSON.stringify(await apiPost(`/api/servers/${selectedServerId}/ai/analyze`, { question }), null, 2)); }
  return <div className="page"><section className="hero glass"><div><p className="eyebrow">Advanced Modules</p><h1>Advanced Lab</h1><p className="muted">Dynamic Economy Preview/Apply, Event-Spawn Map Data und lokaler Diagnose-Analyzer.</p></div><ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/></section><section className="two-column"><div className="panel glass form"><div className="panel-title"><Database size={20}/><h2>Dynamic Economy</h2></div><button onClick={dyn} disabled={!selectedServerId}>Analyze groups</button><label><span>Category</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option>food</option><option>weapons</option><option>medical</option><option>tools</option><option>all</option></select></label><label><span>Multiplier</span><input type="number" step="0.05" value={multiplier} onChange={(e) => setMultiplier(Number(e.target.value))}/></label><button onClick={preview} disabled={!selectedServerId}>Preview Diff</button><label><span>Confirm token for apply</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="APPLY_DYNAMIC_ECONOMY_TO_TEST_COPY" /></label><button className="danger" onClick={apply} disabled={!selectedServerId}>Apply with Backup</button><hr/><button onClick={map} disabled={!selectedServerId} className="secondary"><Map size={18}/>Load Map Event Points</button><hr/><input value={question} onChange={(e) => setQuestion(e.target.value)}/><button onClick={ai} disabled={!selectedServerId}><Bot size={18}/>Local Diagnostic Analyzer</button></div><div className="panel glass"><h2>Output</h2><pre className="logbox">{out || "No advanced output yet."}</pre></div></section></div>;
}
