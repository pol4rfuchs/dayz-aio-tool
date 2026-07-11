import { Database, Save, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiGet, apiPost, apiPut } from "../lib/api";
import type { DiffLine, ServerRecord } from "../lib/types";

type DayzTypeItem = { name: string; nominal: number; min: number; lifetime: number; restock: number; quantmin: number; quantmax: number; cost: number; category?: string; flags: Record<string, boolean>; usage: string[]; value: string[] };
type DayzEventItem = { name: string; nominal: number; min: number; max: number; lifetime: number; restock: number; saferadius: number; distanceradius: number; cleanupradius: number; active: boolean; children: string[] };
type DayzGlobalItem = { name: string; type: string; value: string };
type SpawnableSummary = { name: string; cargoPresets: number; cargoItems: number; attachmentPresets: number; attachments: number };
type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };
const files = ["types.xml", "events.xml", "globals.xml", "cfgspawnabletypes.xml", "cfgeventspawns.xml", "cfgrandompresets.xml", "messages.xml"];

function validationText(validation: any) {
  if (!validation) return "";
  if (validation.summary?.grouped?.length) {
    return validation.summary.grouped.slice(0, 4).map((group: any) => {
      const kind = group.severity === "error" ? "ERROR" : "WARN";
      const examples = group.examples?.length ? ` Examples: ${group.examples.slice(0, 6).join(", ")}${group.examples.length > 6 ? ", ..." : ""}` : "";
      return `${kind} ${group.code}: ${group.count}x ${group.message}${examples}`;
    }).join(" | ");
  }
  if (validation.valid === false) return `Validation errors: ${validation.errors?.slice(0, 3).join(" | ")}`;
  if (validation.warnings?.length) return `Validation warnings: ${validation.warnings.slice(0, 3).join(" | ")}`;
  return "";
}

export function EconomyEditor({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [file, setFile] = useState("types.xml");
  const [xml, setXml] = useState("");
  const [items, setItems] = useState<DayzTypeItem[]>([]);
  const [events, setEvents] = useState<DayzEventItem[]>([]);
  const [globals, setGlobals] = useState<DayzGlobalItem[]>([]);
  const [spawnable, setSpawnable] = useState<SpawnableSummary[]>([]);
  const [query, setQuery] = useState("");
  const [diff, setDiff] = useState<DiffLine[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => { apiGet<ServerRecord[]>("/api/servers").then((s) => { setServers(s); if (!selectedServerId && s[0]) setSelectedServerId(s[0].id); }); }, []);
  async function load() {
    if (!selectedServerId) return;
    const r = await apiGet<any>(`/api/servers/${selectedServerId}/economy/${file}`);
    setXml(r.xml || "");
    setItems(r.items || []);
    setEvents(r.events || []);
    setGlobals(r.globals || []);
    setSpawnable(r.spawnable || []);
    setDiff([]);
    setMessage(validationText(r.validation));
  }
  useEffect(() => { load().catch((e) => setMessage(e.message)); }, [selectedServerId, file]);

  const visibleTypes = useMemo(() => items.filter((item) => `${item.name} ${item.category ?? ""} ${item.usage?.join(" ") ?? ""}`.toLowerCase().includes(query.toLowerCase())).slice(0, 300), [items, query]);
  const visibleEvents = useMemo(() => events.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 300), [events, query]);
  const visibleGlobals = useMemo(() => globals.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 300), [globals, query]);
  const visibleSpawnable = useMemo(() => spawnable.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 300), [spawnable, query]);

  function updateType(name: string, key: keyof Pick<DayzTypeItem, "nominal"|"min"|"lifetime"|"restock"|"quantmin"|"quantmax"|"cost">, value: string) { setItems((prev) => prev.map((item) => item.name === name ? { ...item, [key]: Number(value) } : item)); }
  function updateEvent(name: string, key: keyof Pick<DayzEventItem, "nominal"|"min"|"max"|"lifetime"|"restock"|"saferadius"|"distanceradius"|"cleanupradius">, value: string) { setEvents((prev) => prev.map((item) => item.name === name ? { ...item, [key]: Number(value) } : item)); }
  function updateEventActive(name: string, active: boolean) { setEvents((prev) => prev.map((item) => item.name === name ? { ...item, active } : item)); }
  function updateGlobal(name: string, value: string) { setGlobals((prev) => prev.map((item) => item.name === name ? { ...item, value } : item)); }

  async function saveRaw() { const r = await apiPut<any>(`/api/servers/${selectedServerId}/economy/${file}`, { xml }); setMessage(r.ok ? `${file} saved with backup.${validationText(r.validation) ? ` Warnings: ${validationText(r.validation)}` : ""}` : "Save failed"); await load(); }
  async function saveTable() { const r = await apiPut<any>(`/api/servers/${selectedServerId}/economy/types/items`, { items }); setMessage(r.ok ? `types.xml table saved with backup.${validationText(r.validation) ? ` Warnings: ${validationText(r.validation)}` : ""}` : "Save failed"); await load(); }
  async function saveEvents() { const r = await apiPut<any>(`/api/servers/${selectedServerId}/economy/events/items`, { items: events }); setMessage(r.ok ? `events.xml table saved with backup.${validationText(r.validation) ? ` Warnings: ${validationText(r.validation)}` : ""}` : "Save failed"); await load(); }
  async function saveGlobals() { const r = await apiPut<any>(`/api/servers/${selectedServerId}/economy/globals/items`, { items: globals }); setMessage(r.ok ? `globals.xml table saved with backup.${validationText(r.validation) ? ` Warnings: ${validationText(r.validation)}` : ""}` : "Save failed"); await load(); }
  async function makeDiff() { setDiff((await apiPost<{ diff: DiffLine[] }>(`/api/servers/${selectedServerId}/economy/${file}/diff`, { xml })).diff); }

  return <div className="page">
    <section className="hero glass"><div><p className="eyebrow">Central Economy</p><h1>Economy Editor Pro</h1><p className="muted">types/events/globals Tabelleneditor plus Raw XML + Diff für weitere CE-Dateien.</p></div><div className="actions"><ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/><select value={file} onChange={(e) => setFile(e.target.value)}>{files.map((f) => <option key={f}>{f}</option>)}</select></div></section>
    {message && <div className="message warning-box"><strong>Status</strong><p>{message}</p></div>}
    <section className="panel glass"><div className="panel-title"><Search size={20}/><h2>Search</h2></div><input placeholder="Search item/event/global/spawnable" value={query} onChange={(e) => setQuery(e.target.value)} /></section>

    {file === "types.xml" && <section className="panel glass"><div className="panel-title"><Database size={20}/><h2>types.xml Table</h2></div><div className="table-wrap"><table><thead><tr><th>Item</th><th>Nominal</th><th>Min</th><th>Lifetime</th><th>Restock</th><th>QMin</th><th>QMax</th><th>Cost</th><th>Category</th><th>Usage</th></tr></thead><tbody>{visibleTypes.map((item) => <tr key={item.name} className={item.min > item.nominal ? "warning-row" : ""}><td>{item.name}</td>{(["nominal","min","lifetime","restock","quantmin","quantmax","cost"] as const).map((key) => <td key={key}><input className="tiny" type="number" value={item[key]} onChange={(e) => updateType(item.name, key, e.target.value)} /></td>)}<td>{item.category}</td><td>{item.usage?.join(", ")}</td></tr>)}</tbody></table></div><div className="actions"><button onClick={saveTable} disabled={!selectedServerId}><Save size={18}/>Save types table</button></div></section>}

    {file === "events.xml" && <section className="panel glass"><div className="panel-title"><Database size={20}/><h2>events.xml Table</h2></div><div className="table-wrap"><table><thead><tr><th>Event</th><th>Active</th><th>Nominal</th><th>Min</th><th>Max</th><th>Lifetime</th><th>Restock</th><th>Safe</th><th>Distance</th><th>Cleanup</th></tr></thead><tbody>{visibleEvents.map((item) => <tr key={item.name} className={item.min > item.nominal ? "warning-row" : ""}><td>{item.name}</td><td><input type="checkbox" checked={item.active} onChange={(e) => updateEventActive(item.name, e.target.checked)} /></td>{(["nominal","min","max","lifetime","restock","saferadius","distanceradius","cleanupradius"] as const).map((key) => <td key={key}><input className="tiny" type="number" value={item[key]} onChange={(e) => updateEvent(item.name, key, e.target.value)} /></td>)}</tr>)}</tbody></table></div><div className="actions"><button onClick={saveEvents} disabled={!selectedServerId}><Save size={18}/>Save events table</button></div></section>}

    {file === "globals.xml" && <section className="panel glass"><div className="panel-title"><Database size={20}/><h2>globals.xml Table</h2></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Value</th></tr></thead><tbody>{visibleGlobals.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.type}</td><td><input value={item.value} onChange={(e) => updateGlobal(item.name, e.target.value)} /></td></tr>)}</tbody></table></div><div className="actions"><button onClick={saveGlobals} disabled={!selectedServerId}><Save size={18}/>Save globals table</button></div></section>}

    {file === "cfgspawnabletypes.xml" && <section className="panel glass"><div className="panel-title"><Database size={20}/><h2>cfgspawnabletypes.xml Summary</h2></div><div className="table-wrap"><table><thead><tr><th>Type</th><th>Cargo Presets</th><th>Cargo Items</th><th>Attachment Presets</th><th>Attachments</th></tr></thead><tbody>{visibleSpawnable.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.cargoPresets}</td><td>{item.cargoItems}</td><td>{item.attachmentPresets}</td><td>{item.attachments}</td></tr>)}</tbody></table></div><p className="hint">Complex spawnable editing stays in Raw XML + Diff mode to avoid destructive merges.</p></section>}

    <section className="two-column wide-left"><div className="panel glass"><div className="panel-title"><Database size={20}/><h2>Raw XML</h2></div><textarea className="code-editor" value={xml} onChange={(e) => setXml(e.target.value)} /><div className="actions"><button onClick={makeDiff} disabled={!selectedServerId}>Diff Preview</button><button onClick={saveRaw} disabled={!selectedServerId}><Save size={18}/>Save raw XML</button></div></div><div className="panel glass"><h2>Diff</h2><pre className="diffbox">{diff.map((line) => `${line.type === "add" ? "+" : line.type === "remove" ? "-" : " "} ${line.line}`).join("\n") || "No diff generated."}</pre></div></section>
  </div>;
}
