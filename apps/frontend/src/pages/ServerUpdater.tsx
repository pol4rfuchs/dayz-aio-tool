import { KeyRound, RefreshCcw, ServerCog, ShieldCheck, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { UpdateJobProgress } from "../components/UpdateJobProgress";
import { apiGet, apiPost } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };
type UpdatePreflight = { ok: boolean; steamcmdPath: string; appId: string; installDir: string; auth?: { selectedMode: "anonymous" | "user"; username?: string; cachedSessionLikely?: boolean; steamGuardLikelyNeeded?: boolean; storesPassword: false }; checks: Array<{ name: string; status: "pass" | "warn" | "fail"; message: string }> };
type ServerState = { exe: { exists: boolean; path: string; size?: number; lastWriteTime?: string; fileVersion?: string; productVersion?: string }; manifest: { exists: boolean; path: string; stateFlags?: string; installDir?: string; lastUpdated?: string; buildId?: string }; steamcmdPath: string; installDir: string; appId: string };
type UpdateJob = { id: string; action: string; status: string; total: number; completed: number; failed: number; current?: string; results: Array<{ target: string; exitCode: number; outputTail: string; verification?: { reason?: string; authMode?: string; beforeExe?: unknown; afterExe?: unknown; steam?: { findings: string[]; hasSuccess: boolean } } }>; error?: string; createdAt: string; updatedAt: string; finishedAt?: string };

export function ServerUpdater({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [steamUsername, setSteamUsername] = useState(() => localStorage.getItem("dayz_aio_steam_username") || "");
  const [steamLoginMode, setSteamLoginMode] = useState<"anonymous" | "user">(() => (localStorage.getItem("dayz_aio_steam_login_mode") === "user" ? "user" : "anonymous"));
  const [preflight, setPreflight] = useState<UpdatePreflight | null>(null);
  const [state, setState] = useState<ServerState | null>(null);
  const [jobs, setJobs] = useState<UpdateJob[]>([]);
  const [message, setMessage] = useState("");

  function steamAuthPayload() {
    const user = steamUsername.trim();
    localStorage.setItem("dayz_aio_steam_login_mode", steamLoginMode);
    if (user) localStorage.setItem("dayz_aio_steam_username", user);
    else localStorage.removeItem("dayz_aio_steam_username");
    return steamLoginMode === "user" ? { steamLoginMode: "user", steamUsername: user } : { steamLoginMode: "anonymous" };
  }

  function updatePreflightPath() {
    const payload = steamAuthPayload();
    const params = new URLSearchParams();
    params.set("steamLoginMode", payload.steamLoginMode);
    if ("steamUsername" in payload && payload.steamUsername) params.set("steamUsername", payload.steamUsername);
    return `/api/servers/${selectedServerId}/updates/preflight?${params.toString()}`;
  }

  useEffect(() => {
    apiGet<ServerRecord[]>("/api/servers").then((items) => {
      setServers(items);
      if (!selectedServerId && items[0]) setSelectedServerId(items[0].id);
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  async function refresh() {
    if (!selectedServerId) return;
    const [nextPreflight, nextState, nextJobs] = await Promise.all([
      apiGet<UpdatePreflight>(updatePreflightPath()),
      apiGet<ServerState>(`/api/servers/${selectedServerId}/updates/server-state`),
      apiGet<{ items: UpdateJob[] }>(`/api/updates/jobs?serverId=${encodeURIComponent(selectedServerId)}`)
    ]);
    setPreflight(nextPreflight);
    setState(nextState);
    setJobs(nextJobs.items.filter((job) => job.action === "server-update"));
  }

  useEffect(() => { refresh().catch(() => undefined); }, [selectedServerId]);

  useEffect(() => {
    if (!selectedServerId) return;
    const active = jobs.some((job) => !["done", "success", "succeeded", "completed", "failed", "error", "cancelled", "canceled"].includes(job.status.toLowerCase()));
    if (!active) return;
    const timer = window.setInterval(() => { refresh().catch(() => undefined); }, 2500);
    return () => window.clearInterval(timer);
  }, [selectedServerId, jobs]);

  async function openSteamCmdLogin() {
    const user = steamUsername.trim();
    if (!user) {
      setMessage("Steam user fehlt. Wähle Steam user/session und trage deinen Steam-Login-User ein.");
      return;
    }
    const result = await apiPost<{ launched: boolean; launchAttempted?: boolean; message: string; scriptPath?: string; manualOpenPath?: string; manualCommand?: string }>(`/api/servers/${selectedServerId}/updates/steam-login-session`, { steamUsername: user, keepOpen: true });
    setMessage([
      result.message || "SteamCMD login helper prepared.",
      result.manualOpenPath ? `Fallback: ${result.manualOpenPath}` : undefined,
      result.manualCommand ? `Command: ${result.manualCommand}` : undefined
    ].filter(Boolean).join("\n"));
    await refresh();
  }

  async function updateServer() {
    const result = await apiPost<{ queued: boolean; jobId: string }>(`/api/servers/${selectedServerId}/updates/server`, steamAuthPayload());
    setMessage(`Dedicated server update queued · job ${result.jobId}`);
    await refresh();
  }

  const latestJob = jobs[0];

  return <div className="page">
    <section className="hero glass">
      <div>
        <p className="eyebrow">SteamCMD · AppID 223350</p>
        <h1>Server Updater</h1>
        <p className="muted">Dedizierter DayZ-Server separat vom Mod-Updater. Nutzt Steam-Login, wenn anonymous mit <code>No subscription</code> scheitert. Erfolg zählt erst nach EXE-Version/Datum-Prüfung.</p>
      </div>
      <ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/>
    </section>

    <section className="two-column">
      <div className="panel glass">
        <div className="panel-title"><ServerCog size={20}/><h2>Dedicated Server State</h2></div>
        <div className="actions">
          <button className="secondary" onClick={refresh} disabled={!selectedServerId}><RefreshCcw size={18}/>Refresh</button>
          <button className="secondary" onClick={openSteamCmdLogin} disabled={!selectedServerId || steamLoginMode !== "user" || !steamUsername.trim()}><KeyRound size={18}/>Open SteamCMD login</button>
          <button onClick={updateServer} disabled={!selectedServerId}><UploadCloud size={18}/>Update DayZ Server</button>
        </div>
        <div className="form-grid">
          <label>Steam login mode <select value={steamLoginMode} onChange={(event) => setSteamLoginMode(event.target.value as "anonymous" | "user")}><option value="anonymous">anonymous</option><option value="user">Steam user/session</option></select></label>
          <label>Steam login user <input value={steamUsername} onChange={(event) => setSteamUsername(event.target.value)} placeholder="Steam username; password never stored" disabled={steamLoginMode === "anonymous"} /></label>
        </div>
        <p className="hint">Kein Passwort-Speichern. Mit „Open SteamCMD login“ öffnet AIO ein lokales SteamCMD-Fenster für Passwort/Steam Guard. Danach wird nur die gecachte Session genutzt.</p>
        {message ? <p className="hint">{message}</p> : null}
        {state ? <div className="timeline">
          <article className="timeline-item"><div><strong>Executable</strong><span>{state.exe.exists ? `${state.exe.productVersion || state.exe.fileVersion || "unknown"} · ${state.exe.lastWriteTime || "no time"}` : "missing"}</span></div></article>
          <article className="timeline-item"><div><strong>EXE path</strong><span>{state.exe.path}</span></div></article>
          <article className="timeline-item"><div><strong>Manifest</strong><span>{state.manifest.exists ? `build ${state.manifest.buildId || "unknown"} · state ${state.manifest.stateFlags || "?"}` : "missing"}</span></div></article>
          <article className="timeline-item"><div><strong>SteamCMD</strong><span>{state.steamcmdPath}</span></div></article>
        </div> : null}
      </div>

      <div className="panel glass">
        <div className="panel-title"><ShieldCheck size={20}/><h2>Preflight</h2></div>
        {preflight ? <div className="timeline">
          {preflight.checks.map((check) => <article className="timeline-item" key={check.name}><div><strong>{check.name}</strong><span>{check.status} · {check.message}</span></div></article>)}
        </div> : <p className="muted">No preflight loaded.</p>}
      </div>
    </section>

    <section className="panel glass">
      <h2>Server Update Jobs</h2>
      {latestJob ? <UpdateJobProgress job={latestJob} title="Latest server update"/> : null}
      <div className="timeline">
        {jobs.map((job) => <article className="timeline-item" key={job.id}>
          <div><strong>{job.action} · {job.status}</strong><span>{job.completed}/{job.total} done · failed {job.failed} · {new Date(job.updatedAt).toLocaleString()}</span></div>
          {job.results.length ? <pre className="logbox small">{job.results.slice(-1)[0].outputTail || JSON.stringify(job.results.slice(-1)[0], null, 2)}</pre> : null}
        </article>)}
        {!jobs.length ? <p className="muted">No server update jobs yet.</p> : null}
      </div>
    </section>
  </div>;
}
