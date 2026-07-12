import { DownloadCloud, GripVertical, Package, RefreshCcw, Save, ServerCog, ShieldAlert, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { UpdateJobProgress } from "../components/UpdateJobProgress";
import { apiGet, apiPost, apiPut } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type ModRow = { id: string; folderName: string; displayName: string; workshopId?: string; enabled: number; loadOrder: number; hasKeys: number };
type ModIssue = { severity: "error" | "warning" | "info"; code: string; mod?: string; message: string; details?: unknown };
type ModDiagnostics = { summary: { mods: number; enabled: number; errors: number; warnings: number; info: number; duplicatePbos: number; duplicateKeys: number }; issues: ModIssue[]; declaredDependencies: Array<{ mod: string; dependencies: string[] }> };
type WorkshopPreflight = { ok: boolean; checks: Array<{ name: string; status: "pass" | "warn" | "fail"; message: string }> };
type UpdatePreflight = { ok: boolean; steamcmdPath: string; appId: string; workshopAppId: string; installDir: string; workshopStagingRoot: string; modIds: string[]; checks: Array<{ name: string; status: "pass" | "warn" | "fail"; message: string }> };
type UpdateJob = { id: string; action: string; status: string; total: number; completed: number; failed: number; current?: string; results: Array<{ target: string; exitCode: number; outputTail: string; copied?: boolean }>; error?: string; createdAt: string; updatedAt: string; finishedAt?: string };
type KeySyncPlan = { serverKeysPath: string; totalKeys: number; copyCount: number; existingCount: number; missingModKeys: string[]; plan: Array<{ mod: string; source: string; target: string; action: "copy" | "exists" }> };
type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };

export function Mods({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [mods, setMods] = useState<ModRow[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [workshopId, setWorkshopId] = useState("");
  const [folderName, setFolderName] = useState("");
  const [message, setMessage] = useState("");
  const [diagnostics, setDiagnostics] = useState<ModDiagnostics | null>(null);
  const [preflight, setPreflight] = useState<WorkshopPreflight | null>(null);
  const [updatePreflight, setUpdatePreflight] = useState<UpdatePreflight | null>(null);
  const [updateJobs, setUpdateJobs] = useState<UpdateJob[]>([]);
  const [keyPlan, setKeyPlan] = useState<KeySyncPlan | null>(null);
  const [steamUsername, setSteamUsername] = useState(() => localStorage.getItem("dayz_aio_steam_username") || "");

  function steamAuthPayload() {
    const user = steamUsername.trim();
    if (user) localStorage.setItem("dayz_aio_steam_username", user);
    else localStorage.removeItem("dayz_aio_steam_username");
    return user ? { useSteamLogin: true, steamUsername: user } : { useSteamLogin: false };
  }

  useEffect(() => {
    apiGet<ServerRecord[]>("/api/servers").then((s) => {
      setServers(s);
      if (!selectedServerId && s[0]) setSelectedServerId(s[0].id);
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  async function load() {
    if (selectedServerId) setMods(await apiGet<ModRow[]>(`/api/servers/${selectedServerId}/mods`));
  }

  async function loadUpdateJobs() {
    if (!selectedServerId) return;
    const result = await apiGet<{ items: UpdateJob[] }>(`/api/updates/jobs?serverId=${encodeURIComponent(selectedServerId)}`);
    setUpdateJobs(result.items);
  }

  useEffect(() => {
    load().catch((e: Error) => setMessage(e.message));
    loadUpdateJobs().catch(() => undefined);
    setDiagnostics(null);
    setPreflight(null);
    setUpdatePreflight(null);
    setKeyPlan(null);
  }, [selectedServerId]);

  useEffect(() => {
    if (!selectedServerId) return;
    const active = updateJobs.some((job) => !["done", "success", "succeeded", "completed", "failed", "error", "cancelled", "canceled"].includes(job.status.toLowerCase()));
    if (!active) return;
    const timer = window.setInterval(() => { loadUpdateJobs().catch(() => undefined); }, 2500);
    return () => window.clearInterval(timer);
  }, [selectedServerId, updateJobs]);

  const modParam = useMemo(() => mods.filter((m) => m.enabled).map((m) => m.folderName).join(";"), [mods]);

  function move(from: number, to: number) {
    const next = [...mods];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setMods(next);
  }

  async function scan() {
    const r = await apiPost<{ mods: ModRow[] }>(`/api/servers/${selectedServerId}/mods/scan`);
    setMods(r.mods);
    setMessage("Mod scan completed. Numeric Workshop-ID folders are included.");
  }

  async function save() {
    await apiPut(`/api/servers/${selectedServerId}/mods/load-order`, { mods: mods.map((m) => ({ folderName: m.folderName, enabled: Boolean(m.enabled), workshopId: m.workshopId })) });
    setMessage("Load order saved with backup.");
    await load();
  }

  async function analyzeMods() {
    setDiagnostics(await apiGet<ModDiagnostics>(`/api/servers/${selectedServerId}/mods/diagnostics`));
  }

  async function runWorkshopPreflight() {
    setPreflight(await apiGet<WorkshopPreflight>(`/api/servers/${selectedServerId}/workshop/preflight`));
  }

  async function runUpdatePreflight() {
    setUpdatePreflight(await apiGet<UpdatePreflight>(`/api/servers/${selectedServerId}/updates/preflight`));
  }

  async function installWorkshop() {
    const r = await apiPost<{ queued: boolean; jobId: string; folderName: string }>(`/api/servers/${selectedServerId}/workshop/install`, { workshopId, folderName, username: steamUsername.trim() || "anonymous" });
    setMessage(`Workshop install queued: ${r.folderName} · job ${r.jobId}`);
    await loadUpdateJobs();
  }

  async function updateEnabledWorkshop() {
    const r = await apiPost<{ queued: boolean; jobId: string; count: number }>(`/api/servers/${selectedServerId}/workshop/update-enabled`, { username: steamUsername.trim() || "anonymous" });
    setMessage(`Enabled Workshop update queued: ${r.count} mods · job ${r.jobId}`);
    await loadUpdateJobs();
  }

  async function updateDedicatedServer() {
    const r = await apiPost<{ queued: boolean; jobId: string }>(`/api/servers/${selectedServerId}/updates/server`, steamAuthPayload());
    setMessage(`Dedicated Server update queued · job ${r.jobId}`);
    await loadUpdateJobs();
  }

  async function updateLaunchProfileMods() {
    const r = await apiPost<{ queued: boolean; jobId: string; count: number }>(`/api/servers/${selectedServerId}/updates/mods`, steamAuthPayload());
    setMessage(`Workshop mod update queued: ${r.count} mods · job ${r.jobId}`);
    await loadUpdateJobs();
  }

  async function planKeySync() {
    setKeyPlan(await apiGet<KeySyncPlan>(`/api/servers/${selectedServerId}/mods/key-sync/plan`));
  }

  async function runKeySync() {
    const result = await apiPost<{ copied: unknown[]; plan: KeySyncPlan }>(`/api/servers/${selectedServerId}/mods/key-sync`);
    setKeyPlan(result.plan);
    setMessage(`Key sync completed: ${result.copied.length} .bikey files copied.`);
    await load();
  }

  const latestJob = updateJobs[0];

  return <div className="page">
    <section className="hero glass">
      <div>
        <p className="eyebrow">Workshop & Load Order</p>
        <h1>Mod Manager</h1>
        <p className="muted">@Folder-/Workshop-ID-Scan, Load-Order, Dedicated-Server-Update, Workshop-Mod-Update und Konflikt-/Dependency-Diagnose.</p>
      </div>
      <ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/>
    </section>

    <section className="two-column">
      <div className="panel glass">
        <div className="panel-title"><Package size={20}/><h2>Load Order</h2></div>
        <div className="actions">
          <button onClick={scan} disabled={!selectedServerId}><RefreshCcw size={18}/>Scan folders</button>
          <button onClick={save} disabled={!selectedServerId}><Save size={18}/>Save order</button>
          <button className="secondary" onClick={analyzeMods} disabled={!selectedServerId}><ShieldAlert size={18}/>Analyze conflicts</button>
          <button className="secondary" onClick={planKeySync} disabled={!selectedServerId}>Plan key sync</button>
          <button onClick={runKeySync} disabled={!selectedServerId}>Sync .bikey files</button>
        </div>
        {message && <p className="hint">{message}</p>}
        <div className="mod-list">
          {mods.map((mod, index) => <div className="mod-row" key={mod.folderName} draggable onDragStart={() => setDrag(index)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, index); setDrag(null); }}>
            <GripVertical size={16}/>
            <input type="checkbox" checked={Boolean(mod.enabled)} onChange={(e) => setMods((prev) => prev.map((m) => m.folderName === mod.folderName ? { ...m, enabled: e.target.checked ? 1 : 0 } : m))}/>
            <strong>{mod.folderName}</strong>
            <span>{mod.hasKeys ? "keys ok" : "no keys"}</span>
            <input value={mod.workshopId ?? ""} placeholder="Workshop ID" onChange={(e) => setMods((prev) => prev.map((m) => m.folderName === mod.folderName ? { ...m, workshopId: e.target.value } : m))}/>
          </div>)}
        </div>
        {keyPlan ? <div className="launch-profile-box">
          <h3>Key Sync Plan</h3>
          <p className="muted">Target: <code>{keyPlan.serverKeysPath}</code></p>
          <p>{keyPlan.copyCount} copy · {keyPlan.existingCount} already present · {keyPlan.missingModKeys.length} mods without keys</p>
          {keyPlan.missingModKeys.length ? <pre className="logbox small">{`Mods without keys:\n${keyPlan.missingModKeys.join("\n")}`}</pre> : null}
          <pre className="logbox small">{JSON.stringify(keyPlan.plan.filter((item) => item.action === "copy").slice(0, 80), null, 2)}</pre>
        </div> : null}
      </div>

      <div className="panel glass">
        <div className="panel-title"><UploadCloud size={20}/><h2>Updater</h2></div>
        <p className="muted">Dedicated Server: AppID 223350. Workshop Mods: IDs aus Launch Profile und Mod-Tabelle, Staging unter <code>..\Workshop</code>, danach Copy nach Serverroot.</p>
        <div className="form-grid">
          <label>Steam login user for updates <input value={steamUsername} onChange={(e) => setSteamUsername(e.target.value)} placeholder="Steam username; empty = anonymous" /></label>
        </div>
        <p className="hint">Password is never stored here. Run SteamCMD login once manually for Steam Guard/session reuse. Anonymous bleibt möglich, aber bei No subscription/Access Denied wird der Job jetzt sauber FAILED.</p>
        <div className="actions">
          <button className="secondary" onClick={runUpdatePreflight} disabled={!selectedServerId}><ServerCog size={18}/>Update preflight</button>
          <button onClick={updateDedicatedServer} disabled={!selectedServerId}><ServerCog size={18}/>Update DayZ server</button>
          <button onClick={updateLaunchProfileMods} disabled={!selectedServerId}><DownloadCloud size={18}/>Update launch-profile mods</button>
          <button className="secondary" onClick={loadUpdateJobs} disabled={!selectedServerId}><RefreshCcw size={18}/>Refresh jobs</button>
        </div>
        {updatePreflight ? <div className="timeline">
          <article className="timeline-item"><div><strong>SteamCMD</strong><span>{updatePreflight.steamcmdPath}</span></div></article>
          <article className="timeline-item"><div><strong>Mods detected</strong><span>{updatePreflight.modIds.length} Workshop IDs</span></div></article>
          {updatePreflight.checks.map((check) => <article className="timeline-item" key={check.name}><div><strong>{check.name}</strong><span>{check.status} · {check.message}</span></div></article>)}
        </div> : null}
        {latestJob ? <UpdateJobProgress job={latestJob} title="Latest update job"/> : null}
      </div>
    </section>

    <section className="two-column">
      <div className="panel glass">
        <div className="panel-title"><DownloadCloud size={20}/><h2>Steam Workshop single install</h2></div>
        <div className="actions"><button className="secondary" onClick={runWorkshopPreflight} disabled={!selectedServerId}>Workshop preflight</button></div>
        {preflight && <div className="timeline">
          {preflight.checks.map((check) => <article className="timeline-item" key={check.name}><div><strong>{check.name}</strong><span>{check.status} · {check.message}</span></div></article>)}
        </div>}
        <input value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} placeholder="Workshop ID" />
        <input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Optional folder name" />
        <div className="actions"><button onClick={installWorkshop} disabled={!selectedServerId || !workshopId}>Install via SteamCMD</button><button className="secondary" onClick={updateEnabledWorkshop} disabled={!selectedServerId}>Update enabled table mods</button></div>
        <h3>-mod= preview</h3><pre className="logbox small">{modParam || "No enabled mods."}</pre>
      </div>
      <div className="panel glass">
        <h2>Update Jobs</h2>
        <div className="timeline">
          {updateJobs.map((job) => <article className="timeline-item" key={job.id}>
            <div><strong>{job.action} · {job.status}</strong><span>{job.completed}/{job.total} done · failed {job.failed} · {new Date(job.updatedAt).toLocaleString()}</span></div>
            {job.results.length ? <pre className="logbox small">{job.results.slice(-3).map((item) => item.outputTail || JSON.stringify(item, null, 2)).join("\n\n---\n\n")}</pre> : null}
          </article>)}
          {!updateJobs.length ? <p className="muted">No update jobs yet.</p> : null}
        </div>
      </div>
    </section>

    {diagnostics && <section className="panel glass">
      <div className="panel-title"><ShieldAlert size={20}/><h2>Diagnostics</h2></div>
      <p className="muted">{diagnostics.summary.mods} mods · {diagnostics.summary.enabled} enabled · {diagnostics.summary.errors} errors · {diagnostics.summary.warnings} warnings · {diagnostics.summary.info} info</p>
      <div className="timeline">
        {diagnostics.issues.map((issue, index) => <article className="timeline-item" key={`${issue.code}-${index}`}>
          <div><strong>{issue.severity.toUpperCase()} · {issue.code}</strong><span>{issue.mod ? `${issue.mod}: ` : ""}{issue.message}</span></div>
          {issue.details ? <pre className="logbox small">{JSON.stringify(issue.details, null, 2)}</pre> : null}
        </article>)}
      </div>
      {diagnostics.declaredDependencies.length ? <><h3>Declared dependencies from mod.cpp/meta.cpp</h3><pre className="logbox small">{JSON.stringify(diagnostics.declaredDependencies, null, 2)}</pre></> : null}
    </section>}
  </div>;
}
