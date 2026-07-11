import { KeyRound, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { apiGet, getApiKey, setApiKey } from "../lib/api";

type AuthStatus = { authRequired: boolean; header: string; bearerSupported: boolean };

export function Security({ onSaved }: { onSaved?: () => void }) {
  const [key, setKey] = useState(getApiKey());
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { apiGet<AuthStatus>("/api/auth/status").then(setStatus).catch((err) => setError((err as Error).message)); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setApiKey(key);
    setMessage("");
    setError("");
    try {
      await apiGet("/api/system/readiness");
      setMessage("API-Key gespeichert und erfolgreich geprüft.");
      onSaved?.();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return <div className="page narrow-page">
    <section className="hero glass compact-hero"><div><p className="eyebrow">Security</p><h1>API Access</h1><p className="muted">DayZ AIO blockiert alle kritischen API-Aktionen ohne gültigen API-Key.</p></div><ShieldCheck /></section>
    <form className="panel glass form" onSubmit={submit}>
      <div className="panel-title"><KeyRound size={20}/><h2>API-Key eintragen</h2></div>
      <p className="muted">Den Key findest du nach <code>install-windows.bat</code> in <code>apps/backend/.env</code> als <code>DAYZ_AIO_API_KEY</code>.</p>
      <label><span>DAYZ_AIO_API_KEY</span><input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="starker API-Key aus apps/backend/.env" /></label>
      <div className="actions"><button type="submit"><ShieldCheck size={18}/>Speichern & prüfen</button></div>
      {status ? <div className="message"><strong>Backend Auth Status</strong><p>Auth required: {String(status.authRequired)} · Header: {status.header}</p></div> : null}
      {message ? <div className="message success-box"><strong>OK</strong><p>{message}</p></div> : null}
      {error ? <div className="message error-box"><strong>Fehler</strong><p>{error}</p></div> : null}
    </form>
  </div>;
}
