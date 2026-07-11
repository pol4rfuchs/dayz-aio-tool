import { CalendarClock, Play, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiDelete, apiGet, apiPost } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Schedule = { id: string; serverId: string; name: string; action: string; enabled: number; intervalMinutes?: number; atTime?: string; nextRunAt?: string; lastRunAt?: string; failureCount?: number; lastError?: string };
type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };

export function Scheduler({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [items, setItems] = useState<Schedule[]>([]);
  const [form, setForm] = useState({ name: "Restart every 6h", action: "restart", intervalMinutes: "360", atTime: "" });

  useEffect(() => { apiGet<ServerRecord[]>("/api/servers").then((s) => { setServers(s); if (!selectedServerId && s[0]) setSelectedServerId(s[0].id); }); }, []);
  async function load() { if (selectedServerId) setItems((await apiGet<{ items: Schedule[] }>(`/api/schedules?serverId=${selectedServerId}`)).items); }
  useEffect(() => { load(); }, [selectedServerId]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    await apiPost("/api/schedules", { serverId: selectedServerId, name: form.name, action: form.action, enabled: true, intervalMinutes: form.intervalMinutes ? Number(form.intervalMinutes) : undefined, atTime: form.atTime || undefined });
    await load();
  }

  return <div className="page">
    <section className="hero glass">
      <div><p className="eyebrow">Automation</p><h1>Restart Scheduler</h1><p className="muted">Schedules für Restart, Start, Stop und Backup. Fehler werden gespeichert, retry-scheduled und ab Grenzwert eskaliert.</p></div>
      <ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/>
    </section>
    <section className="two-column">
      <form className="panel glass form" onSubmit={submit}>
        <div className="panel-title"><CalendarClock size={20}/><h2>New schedule</h2></div>
        <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}/>
        <select value={form.action} onChange={(e) => setForm({...form, action: e.target.value})}><option>restart</option><option>backup</option><option>start</option><option>stop</option></select>
        <label><span>Interval minutes</span><input value={form.intervalMinutes} onChange={(e) => setForm({...form, intervalMinutes: e.target.value})}/></label>
        <label><span>At time HH:MM optional</span><input value={form.atTime} onChange={(e) => setForm({...form, atTime: e.target.value})}/></label>
        <button disabled={!selectedServerId}>Create</button>
      </form>
      <section className="panel glass">
        <h2>Schedules</h2>
        <div className="timeline">{items.map((item) => <article className="timeline-item" key={item.id}>
          <div>
            <strong>{item.name}</strong>
            <span>{item.action} · next {item.nextRunAt ?? "disabled"} · failures {item.failureCount ?? 0}</span>
            {item.lastError ? <span className="danger-text">Last error: {item.lastError}</span> : null}
          </div>
          <div className="actions"><button className="secondary" onClick={() => apiPost(`/api/schedules/${item.id}/run`).then(load)}><Play size={16}/>Run</button><button className="danger" onClick={() => apiDelete(`/api/schedules/${item.id}`).then(load)}><Trash2 size={16}/></button></div>
        </article>)}</div>
      </section>
    </section>
  </div>;
}
