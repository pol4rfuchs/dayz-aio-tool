import { CalendarClock, Pause, Play, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Schedule = { id: string; serverId: string; name: string; action: string; enabled: number; intervalMinutes?: number; atTime?: string; nextRunAt?: string; lastRunAt?: string; failureCount?: number; lastError?: string };
type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };

export function Scheduler({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [items, setItems] = useState<Schedule[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "Restart every 6h", action: "restart", intervalMinutes: "360", atTime: "" });

  useEffect(() => { apiGet<ServerRecord[]>("/api/servers").then((s) => { setServers(s); if (!selectedServerId && s[0]) setSelectedServerId(s[0].id); }).catch((e: Error) => setError(e.message)); }, []);
  async function load() { if (selectedServerId) setItems((await apiGet<{ items: Schedule[] }>(`/api/schedules?serverId=${selectedServerId}`)).items); }
  useEffect(() => { load().catch((e: Error) => setError(e.message)); }, [selectedServerId]);

  async function guarded(fn: () => Promise<unknown>) {
    setError("");
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    await guarded(() => apiPost("/api/schedules", { serverId: selectedServerId, name: form.name, action: form.action, enabled: true, intervalMinutes: form.intervalMinutes ? Number(form.intervalMinutes) : undefined, atTime: form.atTime || undefined }));
  }

  function remove(item: Schedule) {
    if (!window.confirm(`Delete schedule "${item.name}"?`)) return;
    void guarded(() => apiDelete(`/api/schedules/${item.id}`));
  }

  return <div className="page">
    <section className="hero glass">
      <div><p className="eyebrow">Automation</p><h1>Restart Scheduler</h1><p className="muted">Schedules für Restart, Start, Stop und Backup. Fehler werden gespeichert, retry-scheduled und ab Grenzwert eskaliert.</p></div>
      <ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/>
    </section>
    {error ? <div className="message error-box"><strong>Scheduler error</strong><p>{error}</p></div> : null}
    <section className="two-column">
      <form className="panel glass form" onSubmit={submit}>
        <div className="panel-title"><CalendarClock size={20}/><h2>New schedule</h2></div>
        <input aria-label="Schedule name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}/>
        <select aria-label="Action" value={form.action} onChange={(e) => setForm({...form, action: e.target.value})}><option>restart</option><option>backup</option><option>start</option><option>stop</option></select>
        <label><span>Interval minutes</span><input value={form.intervalMinutes} onChange={(e) => setForm({...form, intervalMinutes: e.target.value})}/></label>
        <label><span>At time HH:MM optional</span><input value={form.atTime} onChange={(e) => setForm({...form, atTime: e.target.value})}/></label>
        <button disabled={!selectedServerId}>Create</button>
      </form>
      <section className="panel glass">
        <h2>Schedules</h2>
        <div className="timeline">{items.map((item) => <article className="timeline-item" key={item.id}>
          <div>
            <strong>{item.name}{item.enabled ? "" : " (disabled)"}</strong>
            <span>{item.action} · next {item.enabled ? (item.nextRunAt ?? "n/a") : "disabled"} · failures {item.failureCount ?? 0}</span>
            {item.lastError ? <span className="danger-text">Last error: {item.lastError}</span> : null}
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => void guarded(() => apiPost(`/api/schedules/${item.id}/run`))}><Play size={16}/>Run</button>
            <button className="secondary" onClick={() => void guarded(() => apiPatch(`/api/schedules/${item.id}`, { enabled: !item.enabled }))}>{item.enabled ? <><Pause size={16}/>Disable</> : <><Play size={16}/>Enable</>}</button>
            <button className="danger" aria-label={`Delete ${item.name}`} onClick={() => remove(item)}><Trash2 size={16}/></button>
          </div>
        </article>)}</div>
      </section>
    </section>
  </div>;
}
