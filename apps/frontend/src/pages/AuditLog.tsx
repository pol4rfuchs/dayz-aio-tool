import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiGet } from "../lib/api";
import type { AuditItem, ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };

type AuditMetadata = Record<string, unknown>;

function asObject(value: unknown): AuditMetadata {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AuditMetadata : {};
}

function text(value: unknown, fallback = "n/a") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function shortId(value: unknown) {
  const id = text(value, "");
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id || "n/a";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function compactJson(value: unknown) {
  if (!value) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function updateSummary(item: AuditItem, metadata: AuditMetadata) {
  const verification = asObject(metadata.verification);
  const steam = asObject(verification.steam);
  const findings = Array.isArray(steam.findings) ? steam.findings.filter(Boolean).map(String) : [];
  const copied = metadata.copied;
  const total = metadata.total;
  const failed = metadata.failed;
  const parts = [
    metadata.jobId ? `job ${shortId(metadata.jobId)}` : "",
    total !== undefined ? `total ${text(total)}` : "",
    copied !== undefined ? `copied ${text(copied)}` : "",
    failed !== undefined ? `failed ${text(failed)}` : "",
    verification.reason ? `reason ${text(verification.reason)}` : "",
    findings.length ? `steam ${findings.slice(0, 4).join(", ")}` : ""
  ].filter(Boolean);
  return parts.join(" · ") || item.target;
}

function AuditMetadataView({ item }: { item: AuditItem }) {
  const metadata = asObject(item.metadata);
  const isUpdate = item.action.startsWith("updates.");
  if (isUpdate) {
    const verification = asObject(metadata.verification);
    const beforeExe = asObject(verification.beforeExe);
    const afterExe = asObject(verification.afterExe);
    const steam = asObject(verification.steam);
    const findings = Array.isArray(steam.findings) ? steam.findings.filter(Boolean).map(String) : [];
    return <div className="audit-summary-grid">
      {metadata.jobId ? <div><span>Job</span><strong>{shortId(metadata.jobId)}</strong></div> : null}
      {metadata.total !== undefined ? <div><span>Total</span><strong>{text(metadata.total)}</strong></div> : null}
      {metadata.copied !== undefined ? <div><span>Copied</span><strong>{text(metadata.copied)}</strong></div> : null}
      {metadata.failed !== undefined ? <div><span>Failed</span><strong className={Number(metadata.failed) > 0 ? "danger-text" : undefined}>{text(metadata.failed)}</strong></div> : null}
      {metadata.exitCode !== undefined ? <div><span>Exit code</span><strong>{text(metadata.exitCode)}</strong></div> : null}
      {verification.reason ? <div><span>Reason</span><strong>{text(verification.reason)}</strong></div> : null}
      {verification.authMode ? <div><span>Auth</span><strong>{text(verification.authMode)}</strong></div> : null}
      {findings.length ? <div><span>SteamCMD</span><strong>{findings.slice(0, 3).join(", ")}</strong></div> : null}
      {afterExe.productVersion || afterExe.fileVersion ? <div><span>After EXE</span><strong>{text(afterExe.productVersion || afterExe.fileVersion)}</strong></div> : null}
      {beforeExe.lastWriteTime || afterExe.lastWriteTime ? <div><span>EXE time</span><strong>{text(afterExe.lastWriteTime || beforeExe.lastWriteTime)}</strong></div> : null}
    </div>;
  }
  const raw = compactJson(item.metadata);
  return raw ? <pre className="logbox small audit-raw-json">{raw}</pre> : null;
}

export function AuditLog({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const qs = selectedServerId ? `?serverId=${selectedServerId}&limit=200` : "?limit=200";
    setItems((await apiGet<{ items: AuditItem[] }>(`/api/audit${qs}`)).items);
  }

  useEffect(() => {
    apiGet<ServerRecord[]>("/api/servers").then((rows) => {
      setServers(rows);
      if (!selectedServerId && rows[0]) setSelectedServerId(rows[0].id);
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => { load().catch((error: Error) => setMessage(error.message)); }, [selectedServerId]);

  const updateCount = useMemo(() => items.filter((item) => item.action.startsWith("updates.")).length, [items]);

  return <div className="page">
    <section className="hero glass">
      <div>
        <p className="eyebrow">Traceability</p>
        <h1>Audit Log</h1>
        <p className="muted">Lesbare Ereignisse für Updates, Backups, Mods, Scheduler und RCON. Update-Einträge werden nicht mehr als roher JSON-Block dargestellt.</p>
      </div>
      <ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/>
    </section>
    <section className="panel glass">
      <div className="panel-title"><ShieldCheck size={20}/><h2>Latest actions</h2></div>
      <p className="muted">{items.length} entries · {updateCount} update-related</p>
      {message ? <p className="hint">{message}</p> : null}
      <div className="timeline audit-timeline">
        {items.map((item) => {
          const metadata = asObject(item.metadata);
          return <article className={`timeline-item audit-item ${item.action.includes("failed") ? "danger-row" : ""}`} key={item.id}>
            <div>
              <strong>{item.action}</strong>
              <span>{formatDate(item.createdAt)}</span>
              <p>{item.action.startsWith("updates.") ? updateSummary(item, metadata) : item.target}</p>
              <AuditMetadataView item={item}/>
            </div>
          </article>;
        })}
        {!items.length ? <p className="muted">No audit entries yet.</p> : null}
      </div>
    </section>
  </div>;
}
