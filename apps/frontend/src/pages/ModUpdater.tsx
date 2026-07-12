import { DownloadCloud, KeyRound, RefreshCcw, ShieldAlert, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { UpdateJobProgress } from "../components/UpdateJobProgress";
import { apiGet, apiPost } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };
type UpdatePreflight = { ok: boolean; steamcmdPath: string; workshopAppId: string; workshopStagingRoot: string; modIds: string[]; checks: Array<{ name: string; status: "pass" | "warn" | "fail"; message: string }> };
type UpdateJob = { id: string; action: string; status: string; total: number; completed: number; failed: number; current?: string; results: Array<{ target: string; exitCode: number; outputTail: string; copied?: boolean; verification?: { reason?: string; authMode?: string; steam?: { findings: string[]; hasSuccess: boolean } } }>; error?: string; createdAt: string; updatedAt: string; finishedAt?: string };
type WorkshopSyncReport = { workshopStagingRoot: string; serverKeysPath: string; summary: { total: number; enabled: number; launchProfileIds: number; missingServerFolders: number; missingStagingDownloads: number; stagingNewerThanServer: number; keyProblems: number; expansionRelated: number }; items: Array<{ workshopId: string; folderName: string; modName?: string; enabled: number; inLaunchProfile: boolean; inModTable: boolean; server: { exists: boolean; lastWriteTime?: string; fileCount?: number; totalBytes?: number }; staging: { exists: boolean; lastWriteTime?: string; fileCount?: number; totalBytes?: number }; keyCount: number; copiedKeyCount: number; pboHints: string[]; flags: string[] }> };
type KeySyncPlan = { serverKeysPath: string; totalKeys: number; copyCount: number; existingCount: number; missingModKeys: string[]; plan: Array<{ mod: string; source: string; target: string; action: "copy" | "exists" }> };

export function ModUpdater({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [steamUsername, setSteamUsername] = useState(() => localStorage.getItem("dayz_aio_steam_username") || "");
  const [preflight, setPreflight] = useState<UpdatePreflight | null>(null);
  const [syncReport, setSyncReport] = useState<WorkshopSyncReport | null>(null);
  const [jobs, setJobs] = useState<UpdateJob[]>([]);
  const [keyPlan, setKeyPlan] = useState<KeySyncPlan | null>(null);
  const [message, setMessage] = useState("");

  function steamAuthPayload() {
    const user = steamUsername.trim();
    if (user) localStorage.setItem("dayz_aio_steam_username", user);
    else localStorage.removeItem("dayz_aio_steam_username");
    return user ? { useSteamLogin: true, steamUsername: user } : { useSteamLogin: false };
  }

  useEffect(() => {
    apiGet<ServerRecord[]>("/api/servers").then((items) => {
      setServers(items);
      if (!selectedServerId && items[0]) setSelectedServerId(items[0].id);
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  async function refresh() {
    if (!selectedServerId) return;
    const [nextPreflight, nextReport, nextJobs] = await Promise.all([
      apiGet<UpdatePreflight>(`/api/servers/${selectedServerId}/updates/preflight`),
      apiGet<WorkshopSyncReport>(`/api/servers/${selectedServerId}/updates/workshop-sync-report`),
      apiGet<{ items: UpdateJob[] }>(`/api/updates/jobs?serverId=${encodeURIComponent(selectedServerId)}`)
    ]);
    setPreflight(nextPreflight);
    setSyncReport(nextReport);
    setJobs(nextJobs.items.filter((job) => ["mods-update", "workshop-sync"].includes(job.action)));
  }

  useEffect(() => { refresh().catch(() => undefined); setKeyPlan(null); }, [selectedServerId]);

  useEffect(() => {
    if (!selectedServerId) return;
    const active = jobs.some((job) => !["done", "success", "succeeded", "completed", "failed", "error", "cancelled", "canceled"].includes(job.status.toLowerCase()));
    if (!active) return;
    const timer = window.setInterval(() => { refresh().catch(() => undefined); }, 2500);
    return () => window.clearInterval(timer);
  }, [selectedServerId, jobs]);

  async function updateMods() {
    const result = await apiPost<{ queued: boolean; jobId: string; count: number }>(`/api/servers/${selectedServerId}/updates/mods`, steamAuthPayload());
    setMessage(`Workshop mod update queued: ${result.count} mods · job ${result.jobId}`);
    await refresh();
  }

  async function syncFromStaging() {
    const result = await apiPost<{ queued: boolean; jobId: string; count: number }>(`/api/servers/${selectedServerId}/updates/workshop-sync-from-staging`);
    setMessage(`Workshop staging sync queued: ${result.count} items · job ${result.jobId}`);
    await refresh();
  }

  async function planKeySync() {
    setKeyPlan(await apiGet<KeySyncPlan>(`/api/servers/${selectedServerId}/mods/key-sync/plan`));
  }

  async function runKeySync() {
    const result = await apiPost<{ copied: unknown[]; plan: KeySyncPlan }>(`/api/servers/${selectedServerId}/mods/key-sync`);
    setKeyPlan(result.plan);
    setMessage(`Key sync completed: ${result.copied.length} .bikey files copied.`);
    await refresh();
  }

  const latestJob = jobs[0];
  const expansionItems = syncReport?.items.filter((item) => item.flags.includes("expansion_related")) ?? [];
  const problemItems = syncReport?.items.filter((item) => item.flags.length > 0) ?? [];

  return <div className="page">
    <section className="hero glass">
      <div>
        <p className="eyebrow">SteamCMD · Workshop AppID 221100</p>
        <h1>Mod Updater</h1>
        <p className="muted">Separater Workshop-Sync für Expansion/Mods. Nutzt Steam-Login, kopiert aus Staging in den Serverroot und prüft Keys/Folder-Sync.</p>
      </div>
      <ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/>
    </section>

    <section className="two-column">
      <div className="panel glass">
        <div className="panel-title"><DownloadCloud size={20}/><h2>Workshop Update</h2></div>
        <div className="form-grid">
          <label>Steam login user <input value={steamUsername} onChange={(event) => setSteamUsername(event.target.value)} placeholder="Steam username; required for protected Workshop mods" /></label>
        </div>
        <p className="hint">Kein Passwort-Speichern. Bei Expansion/Workshop <code>Access Denied</code> immer Steam-Login verwenden.</p>
        <div className="actions">
          <button className="secondary" onClick={refresh} disabled={!selectedServerId}><RefreshCcw size={18}/>Refresh sync report</button>
          <button onClick={updateMods} disabled={!selectedServerId}><DownloadCloud size={18}/>Update launch-profile mods</button>
          <button className="secondary" onClick={syncFromStaging} disabled={!selectedServerId}><UploadCloud size={18}/>Sync staging → server</button>
        </div>
        {message ? <p className="hint">{message}</p> : null}
        {preflight ? <div className="timeline">
          <article className="timeline-item"><div><strong>SteamCMD</strong><span>{preflight.steamcmdPath}</span></div></article>
          <article className="timeline-item"><div><strong>Workshop IDs</strong><span>{preflight.modIds.length} detected from launch profile / mod table</span></div></article>
          {preflight.checks.map((check) => <article className="timeline-item" key={check.name}><div><strong>{check.name}</strong><span>{check.status} · {check.message}</span></div></article>)}
        </div> : null}
      </div>

      <div className="panel glass">
        <div className="panel-title"><ShieldAlert size={20}/><h2>Sync Health</h2></div>
        {syncReport ? <>
          <div className="stat-grid">
            <div><strong>{syncReport.summary.total}</strong><span>mods</span></div>
            <div><strong>{syncReport.summary.expansionRelated}</strong><span>Expansion related</span></div>
            <div><strong>{syncReport.summary.stagingNewerThanServer}</strong><span>staging newer</span></div>
            <div><strong>{syncReport.summary.keyProblems}</strong><span>key problems</span></div>
          </div>
          <p className="muted">Staging: <code>{syncReport.workshopStagingRoot}</code></p>
          <p className="muted">Server keys: <code>{syncReport.serverKeysPath}</code></p>
        </> : <p className="muted">No sync report loaded.</p>}
      </div>
    </section>

    <section className="two-column">
      <div className="panel glass">
        <div className="panel-title"><KeyRound size={20}/><h2>Key Sync</h2></div>
        <div className="actions">
          <button className="secondary" onClick={planKeySync} disabled={!selectedServerId}>Plan key sync</button>
          <button onClick={runKeySync} disabled={!selectedServerId}>Sync .bikey files</button>
        </div>
        {keyPlan ? <div className="timeline">
          <article className="timeline-item"><div><strong>Plan</strong><span>{keyPlan.copyCount} copy · {keyPlan.existingCount} already present · {keyPlan.missingModKeys.length} mods without keys</span></div></article>
          {keyPlan.missingModKeys.length ? <article className="timeline-item"><div><strong>Mods without keys</strong><span>{keyPlan.missingModKeys.slice(0, 20).join(", ")}</span></div></article> : null}
        </div> : <p className="muted">No key plan loaded.</p>}
      </div>

      <div className="panel glass">
        <h2>Latest Mod / Sync Job</h2>
        {latestJob ? <UpdateJobProgress job={latestJob} title={latestJob.action === "workshop-sync" ? "Latest staging sync" : "Latest mod update"}/> : <p className="muted">No mod update job yet.</p>}
      </div>
    </section>

    <section className="panel glass">
      <h2>Workshop Synchronization Details</h2>
      <p className="muted">Problematische Einträge zuerst. Expansion-relevante PBOs werden markiert, weil dein aktueller Join-Fehler <code>DayZ-Expansion-Bundle</code> betrifft.</p>
      <div className="timeline">
        {[...problemItems, ...expansionItems.filter((item) => !problemItems.includes(item))].slice(0, 120).map((item) => <article className="timeline-item" key={item.workshopId}>
          <div>
            <strong>{item.folderName}{item.modName ? ` · ${item.modName}` : ""}</strong>
            <span>{item.workshopId} · server {item.server.exists ? "yes" : "missing"} · staging {item.staging.exists ? "yes" : "missing"} · keys {item.copiedKeyCount}/{item.keyCount} · {item.flags.join(", ") || "ok"}</span>
          </div>
          {item.pboHints.length ? <pre className="logbox small">{item.pboHints.filter((pbo) => pbo.toLowerCase().includes("expansion")).slice(0, 20).join("\n") || item.pboHints.slice(0, 12).join("\n")}</pre> : null}
        </article>)}
        {syncReport && !problemItems.length && !expansionItems.length ? <p className="muted">No sync problems detected.</p> : null}
      </div>
    </section>
  </div>;
}
