import { Calculator, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiGet, apiPost } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };

export function ContentTools({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [out, setOut] = useState("");
  const [fullCycleMinutes, setFullCycleMinutes] = useState(240);
  const [nightSpeedMultiplier, setNightSpeedMultiplier] = useState(4);
  const [query, setQuery] = useState("Expansion");
  useEffect(() => { apiGet<ServerRecord[]>("/api/servers").then((s) => { setServers(s); if (!selectedServerId && s[0]) setSelectedServerId(s[0].id); }); }, []);
  async function run(fn: () => Promise<unknown>) { try { setOut(JSON.stringify(await fn(), null, 2)); } catch (e) { setOut((e as Error).message); } }
  return <div className="page"><section className="hero glass"><div><p className="eyebrow">Content Tools</p><h1>Content Tools</h1><p className="muted">Kleine Werkzeuge für Economy/Config: Day/Night-Rechner und Classname-Finder.</p></div><ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/></section><section className="two-column"><div className="panel glass form"><div className="panel-title"><Calculator size={20}/><h2>Day/Night cycle calculator</h2></div><label><span>Gewünschter voller Zyklus in Echtzeit-Minuten</span><input type="number" value={fullCycleMinutes} onChange={(e) => setFullCycleMinutes(Number(e.target.value))}/></label><label><span>Night multiplier</span><input type="number" step="0.25" value={nightSpeedMultiplier} onChange={(e) => setNightSpeedMultiplier(Number(e.target.value))}/></label><button onClick={() => run(() => apiPost("/api/tools/day-night/calculate", { fullCycleMinutes, nightSpeedMultiplier, serverTimePersistent: true }))}>Calculate serverDZ.cfg values</button><hr/><div className="panel-title"><Search size={20}/><h2>Classname finder</h2></div><label><span>Search</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="AKM, Expansion, ZmbF..."/></label><button onClick={() => run(() => apiGet(`/api/servers/${selectedServerId}/economy/classnames?query=${encodeURIComponent(query)}&limit=100`))} disabled={!selectedServerId}>Search classnames</button></div><div className="panel glass"><h2>Output</h2><pre className="logbox">{out || "No content-tool output yet."}</pre></div></section></div>;
}
