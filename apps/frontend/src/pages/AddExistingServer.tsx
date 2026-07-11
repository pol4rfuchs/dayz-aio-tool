import { AlertTriangle, CheckCircle2, FolderSearch, PlusCircle, XCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { apiPost } from "../lib/api";

type LaunchProfile = {
  recommendedLaunchParams: string;
  source?: { filePath: string; type: string; confidence: string; launchParams: string; hints: string[]; modCount?: number; serverModCount?: number; profilePath?: string; importedFrom?: string };
  sources: Array<{ filePath: string; type: string; confidence: string; launchParams: string; hints: string[]; modCount?: number; serverModCount?: number; profilePath?: string; importedFrom?: string }>;
  modFolders: string[];
  modIdFolders?: string[];
  managerMods?: string[];
  managerServerMods?: string[];
  expansionDetected: boolean;
  hasModFolders: boolean;
  hasModParam: boolean;
  hasServerModParam: boolean;
  hasProfilesParam: boolean;
  hasConfigParam: boolean;
  hasPortParam: boolean;
  hasBepathParam: boolean;
  warnings: string[];
  errors: string[];
};

type Detection = {
  rootPath: string; profilePath: string; executablePath: string; configPath: string; missionPath: string; missionTemplate?: string; typesPath: string; launchParams: string; launchProfile?: LaunchProfile;
  valid: boolean; confidence: "low" | "medium" | "high";
  checks: Array<{ key: string; label: string; ok: boolean; path?: string; message: string }>;
  warnings: string[]; errors: string[];
};

type CreatedServer = { id: string; name: string };

export function AddExistingServer({ onCreated }: { onCreated?: (id: string) => void }) {
  const [form, setForm] = useState({ name: "DayZ Testserver", rootPath: "", profilePath: "", executablePath: "", missionPath: "", launchParams: "", steamcmdPath: "", workshopAppId: "221100", rconHost: "127.0.0.1", rconPort: "2306", rconPassword: "" });
  const [detection, setDetection] = useState<Detection | null>(null);
  const [created, setCreated] = useState<CreatedServer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function updateField(key: keyof typeof form, value: string) { setForm((prev) => ({ ...prev, [key]: value })); }

  async function analyze() {
    setBusy(true); setError(""); setCreated(null);
    try {
      const result = await apiPost<Detection>("/api/servers/detect", form);
      setDetection(result);
      setForm((prev) => ({ ...prev, profilePath: result.profilePath || prev.profilePath, executablePath: result.executablePath || prev.executablePath, missionPath: result.missionPath || prev.missionPath, launchParams: result.launchParams || prev.launchParams }));
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const body = { ...form, rconPort: form.rconPort ? Number(form.rconPort) : undefined };
      const result = await apiPost<CreatedServer>("/api/servers", body);
      setCreated(result); onCreated?.(result.id);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  const canCreate = detection?.valid && form.name.trim();

  return <div className="page">
    <section className="hero glass compact-hero"><div><p className="eyebrow">Import</p><h1>Add Existing Server</h1><p className="muted">Root-Pfad scannen, Mission/types.xml erkennen, optional SteamCMD/RCON vorbereiten.</p></div>{detection ? <span className={`confidence ${detection.confidence}`}>{detection.confidence}</span> : null}</section>
    <section className="two-column">
      <form className="panel glass form" onSubmit={submit}>
        <label><span>Display name</span><input value={form.name} onChange={(e) => updateField("name", e.target.value)} /></label>
        <label><span>Root path</span><input value={form.rootPath} onChange={(e) => updateField("rootPath", e.target.value)} placeholder="C:\\DayZServer_TEST" /></label>
        <label><span>Profile path</span><input value={form.profilePath} onChange={(e) => updateField("profilePath", e.target.value)} /></label>
        <label><span>Executable path</span><input value={form.executablePath} onChange={(e) => updateField("executablePath", e.target.value)} /></label>
        <label><span>Mission path</span><input value={form.missionPath} onChange={(e) => updateField("missionPath", e.target.value)} /></label>
        <label><span>Launch params</span><textarea value={form.launchParams} onChange={(e) => updateField("launchParams", e.target.value)} rows={4} /></label>
        <div className="mini-grid"><label><span>SteamCMD path</span><input value={form.steamcmdPath} onChange={(e) => updateField("steamcmdPath", e.target.value)} placeholder="C:\\steamcmd\\steamcmd.exe" /></label><label><span>Workshop App ID</span><input value={form.workshopAppId} onChange={(e) => updateField("workshopAppId", e.target.value)} /></label></div>
        <div className="mini-grid"><label><span>RCON host</span><input value={form.rconHost} onChange={(e) => updateField("rconHost", e.target.value)} /></label><label><span>RCON port</span><input value={form.rconPort} onChange={(e) => updateField("rconPort", e.target.value)} /></label></div>
        <label><span>RCON password</span><input type="password" value={form.rconPassword} onChange={(e) => updateField("rconPassword", e.target.value)} /></label>
        <div className="actions split-actions"><button type="button" onClick={analyze} disabled={busy || !form.rootPath.trim()}><FolderSearch size={18}/>Analyze paths</button><button type="submit" disabled={busy || !canCreate}><PlusCircle size={18}/>Add server</button></div>
      </form>
      <section className="panel glass"><div className="panel-title"><FolderSearch size={20}/><h2>Detection result</h2></div>{!detection && <p className="muted">Noch kein Scan.</p>}{detection?.missionTemplate ? <p className="hint">Active template from serverDZ.cfg: <strong>{detection.missionTemplate}</strong></p> : null}{detection && <div className="checks">{detection.checks.map((check) => <div className="check-row" key={check.key}>{check.ok ? <CheckCircle2 className="ok" size={20}/> : <XCircle className="bad" size={20}/>}<div><strong>{check.label}</strong><span>{check.path || "not detected"}</span><p>{check.message}</p></div></div>)}</div>}
        {detection?.launchProfile ? <div className="launch-profile-box">
          <h3>Launch Profile Import</h3>
          <p className="hint">Quelle: {detection.launchProfile.source?.filePath || "generated fallback"}</p>
          {detection.launchProfile.source?.importedFrom ? <p className="hint">Importer: {detection.launchProfile.source.importedFrom} · Confidence: {detection.launchProfile.source.confidence}</p> : null}
          <pre className="small-code">{detection.launchProfile.recommendedLaunchParams}</pre>
          <div className="tag-row">
            <span className={detection.launchProfile.hasModParam ? "pill ok" : "pill warn"}>-mod={detection.launchProfile.hasModParam ? "yes" : "missing"}</span>
            <span className={detection.launchProfile.hasServerModParam ? "pill ok" : "pill muted"}>-servermod={detection.launchProfile.hasServerModParam ? "yes" : "optional/missing"}</span>
            <span className={detection.launchProfile.expansionDetected ? "pill warn" : "pill muted"}>Expansion {detection.launchProfile.expansionDetected ? "detected" : "not detected"}</span>
            <span className="pill muted">@mods {detection.launchProfile.modFolders.length}</span>
            <span className="pill muted">ID folders {detection.launchProfile.modIdFolders?.length ?? 0}</span>
            <span className={(detection.launchProfile.managerMods?.length ?? 0) ? "pill ok" : "pill muted"}>WS mods {detection.launchProfile.managerMods?.length ?? detection.launchProfile.source?.modCount ?? 0}</span>
            <span className={(detection.launchProfile.managerServerMods?.length ?? 0) ? "pill ok" : "pill muted"}>WS servermods {detection.launchProfile.managerServerMods?.length ?? detection.launchProfile.source?.serverModCount ?? 0}</span>
          </div>
          {detection.launchProfile.source?.hints?.length ? <div className="message"><div><strong>Import details</strong>{detection.launchProfile.source.hints.map((hint) => <p key={hint}>{hint}</p>)}</div></div> : null}
          {detection.launchProfile.errors.length ? <div className="message error-box"><XCircle size={18}/><div><strong>Launch blockers</strong>{detection.launchProfile.errors.map((w) => <p key={w}>{w}</p>)}</div></div> : null}
          {detection.launchProfile.warnings.length ? <div className="message warning-box"><AlertTriangle size={18}/><div><strong>Launch warnings</strong>{detection.launchProfile.warnings.map((w) => <p key={w}>{w}</p>)}</div></div> : null}
        </div> : null}
        {detection?.warnings.length ? <div className="message warning-box"><AlertTriangle size={18}/><div><strong>Warnings</strong>{detection.warnings.map((w) => <p key={w}>{w}</p>)}</div></div> : null}{detection?.errors.length ? <div className="message error-box"><XCircle size={18}/><div><strong>Errors</strong>{detection.errors.map((e) => <p key={e}>{e}</p>)}</div></div> : null}{created ? <div className="message success-box"><CheckCircle2 size={18}/><div><strong>Server added</strong><p>{created.name} wurde gespeichert.</p></div></div> : null}{error ? <div className="message error-box"><XCircle size={18}/><div><strong>Request failed</strong><p>{error}</p></div></div> : null}</section>
    </section>
  </div>;
}
