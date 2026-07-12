import { AlertTriangle, CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";

type UpdateJobLike = {
  id: string;
  action: string;
  status: string;
  total: number;
  completed: number;
  failed: number;
  current?: string;
  results?: Array<{
    target?: string;
    exitCode?: number;
    outputTail?: string;
    copied?: boolean;
    verification?: { reason?: string; authMode?: string; steam?: { findings?: string[]; hasSuccess?: boolean } };
  }>;
  error?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
};

type Props = {
  job: UpdateJobLike;
  title?: string;
  compact?: boolean;
};

function normalizeStatus(status: string) {
  return status.trim().toLowerCase();
}

function isFinished(status: string) {
  const value = normalizeStatus(status);
  return ["done", "success", "succeeded", "completed", "failed", "error", "cancelled", "canceled"].includes(value);
}

function statusKind(status: string) {
  const value = normalizeStatus(status);
  if (["failed", "error", "cancelled", "canceled"].includes(value)) return "fail";
  if (["done", "success", "succeeded", "completed"].includes(value)) return "done";
  if (["running", "active", "working", "in_progress", "processing"].includes(value)) return "running";
  return "queued";
}

function percentFor(job: UpdateJobLike) {
  if (job.total > 0) return Math.max(0, Math.min(100, Math.round((job.completed / job.total) * 100)));
  const kind = statusKind(job.status);
  if (kind === "done") return 100;
  if (kind === "fail") return job.completed > 0 ? 100 : 0;
  return 8;
}

function lastResult(job: UpdateJobLike) {
  return job.results?.length ? job.results[job.results.length - 1] : null;
}

function formatDate(value?: string) {
  if (!value) return "n/a";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

export function UpdateJobProgress({ job, title = "Latest update job", compact = false }: Props) {
  const percent = percentFor(job);
  const kind = statusKind(job.status);
  const result = lastResult(job);
  const output = result?.outputTail?.trim();
  const current = job.current || result?.target || (kind === "queued" ? "Wartet in der SteamCMD-Queue" : "Kein aktueller Schritt gemeldet");
  const failed = job.failed > 0 || kind === "fail";
  const statusLabel = job.status || "unknown";
  const Icon = kind === "done" ? CheckCircle2 : kind === "fail" ? XCircle : kind === "running" ? Loader2 : Clock3;
  const findings = result?.verification?.steam?.findings?.filter(Boolean) ?? [];
  const reason = result?.verification?.reason;

  return <div className={`job-progress-card ${kind}${compact ? " compact" : ""}`}>
    <div className="job-progress-header">
      <div className="job-progress-title">
        <Icon size={18} className={kind === "running" ? "spin" : undefined}/>
        <div>
          <strong>{title}</strong>
          <span>{job.action} · {statusLabel} · job {shortId(job.id)}</span>
        </div>
      </div>
      <div className="job-progress-percent">{percent}%</div>
    </div>

    <div className="job-progress-bar" aria-label={`${title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} role="progressbar">
      <span style={{ width: `${percent}%` }} />
    </div>

    <div className="job-progress-meta">
      <div><span>Fortschritt</span><strong>{job.completed}/{job.total || "?"}</strong></div>
      <div><span>Fehler</span><strong className={failed ? "danger-text" : undefined}>{job.failed}</strong></div>
      <div><span>Aktueller Schritt</span><strong>{current}</strong></div>
      <div><span>Aktualisiert</span><strong>{formatDate(job.updatedAt)}</strong></div>
    </div>

    {job.error ? <div className="job-progress-alert"><AlertTriangle size={16}/><span>{job.error}</span></div> : null}
    {reason ? <div className="job-progress-alert"><AlertTriangle size={16}/><span>{reason}</span></div> : null}
    {findings.length ? <div className="job-progress-alert"><AlertTriangle size={16}/><span>{findings.slice(0, 3).join(" · ")}</span></div> : null}

    {!compact && output ? <pre className="logbox small job-progress-output">{output}</pre> : null}
    {!compact && !output && !isFinished(job.status) ? <p className="muted job-progress-note">Warte auf SteamCMD-/Copy-Ausgabe. Der Job läuft im Backend weiter; Refresh aktualisiert den Status automatisch.</p> : null}
  </div>;
}
