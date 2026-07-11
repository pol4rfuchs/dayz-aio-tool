import { Bell, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost } from "../lib/api";

type Target = { id: string; name: string; type: string; url: string; topic?: string; enabled: number };
export function Notifications() {
  const [items, setItems] = useState<Target[]>([]); const [form, setForm] = useState({ name: "ntfy local", type: "ntfy", url: "https://ntfy.sh", topic: "dayz-aio-test" }); const [message, setMessage] = useState("");
  async function load() { setItems((await apiGet<{ items: Target[] }>("/api/notifications")).items); }
  useEffect(() => { load(); }, []);
  async function submit(e: FormEvent) { e.preventDefault(); await apiPost("/api/notifications", { ...form, enabled: true }); await load(); }
  async function test(id: string) { const r = await apiPost<any>(`/api/notifications/${id}/test`); setMessage(JSON.stringify(r)); }
  return <div className="page"><section className="hero glass"><div><p className="eyebrow">Alerts</p><h1>ntfy / Discord Notifications</h1><p className="muted">Notification Targets anlegen und Test-Push senden.</p></div></section><section className="two-column"><form className="panel glass form" onSubmit={submit}><div className="panel-title"><Bell size={20}/><h2>New target</h2></div><input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}/><select value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}><option>ntfy</option><option>discord</option><option>webhook</option></select><input value={form.url} onChange={(e) => setForm({...form, url: e.target.value})}/><input value={form.topic} onChange={(e) => setForm({...form, topic: e.target.value})} placeholder="ntfy topic optional"/><button>Create target</button>{message && <p className="hint">{message}</p>}</form><section className="panel glass"><h2>Targets</h2><div className="timeline">{items.map((item) => <article className="timeline-item" key={item.id}><div><strong>{item.name}</strong><span>{item.type} · {item.topic}</span><p>{item.url}</p></div><div className="actions"><button className="secondary" onClick={() => test(item.id)}>Test</button><button className="danger" onClick={() => apiDelete(`/api/notifications/${item.id}`).then(load)}><Trash2 size={16}/></button></div></article>)}</div></section></section></div>;
}
