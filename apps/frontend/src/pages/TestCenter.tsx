import { Activity, Play, ShieldCheck, Stethoscope, TestTube2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSelect } from "../components/ServerSelect";
import { apiGet, apiPost } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type Props = { selectedServerId: string; setSelectedServerId: (id: string) => void };
type DoctorCheck = { key: string; label: string; status: "pass" | "warn" | "fail"; message: string; path?: string; details?: unknown };
type DoctorResult = { ok: boolean; pass: number; warn: number; fail: number; createdAt: string; checks: DoctorCheck[] };

function DoctorPanel({ title, result }: { title: string; result?: DoctorResult }) {
  if (!result) return <div className="panel glass"><h2>{title}</h2><p className="muted">Noch nicht geladen.</p></div>;
  return (
    <div className="panel glass">
      <div className="panel-title"><Stethoscope size={20}/><h2>{title}</h2></div>
      <div className={result.ok ? "message success-box" : result.fail ? "message error-box" : "message warning-box"}>
        <Activity size={18}/>
        <div><strong>{result.ok ? "Passed" : result.fail ? "Failed" : "Warnings"}</strong><p>{result.pass} OK · {result.warn} Warn · {result.fail} Fail</p></div>
      </div>
      <div className="checks doctor-checks">
        {result.checks.map((check) => (
          <div className={`check-row doctor-${check.status}`} key={check.key}>
            <span className={check.status === "pass" ? "ok" : check.status === "warn" ? "warning" : "bad"}>{check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "×"}</span>
            <div>
              <strong>{check.label}</strong>
              {check.path ? <span>{check.path}</span> : null}
              <p>{check.message}</p>
              {check.details ? <pre className="mini-pre">{JSON.stringify(check.details, null, 2)}</pre> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TestCenter({ selectedServerId, setSelectedServerId }: Props) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [result, setResult] = useState("");
  const [systemDoctor, setSystemDoctor] = useState<DoctorResult>();
  const [serverDoctor, setServerDoctor] = useState<DoctorResult>();

  async function loadServers() {
    const rows = await apiGet<ServerRecord[]>("/api/servers");
    setServers(rows);
    if (!selectedServerId && rows[0]) setSelectedServerId(rows[0].id);
  }

  async function runSystemDoctor() {
    try { setSystemDoctor(await apiGet<DoctorResult>("/api/system/doctor")); }
    catch (e) { setResult((e as Error).message); }
  }

  async function runServerDoctor() {
    if (!selectedServerId) return;
    try { setServerDoctor(await apiGet<DoctorResult>(`/api/servers/${selectedServerId}/doctor`)); }
    catch (e) { setResult((e as Error).message); }
  }

  async function runSafety() {
    try { setResult(JSON.stringify(await apiPost(`/api/servers/${selectedServerId}/tests/safety`), null, 2)); await runServerDoctor(); }
    catch (e) { setResult((e as Error).message); }
  }

  async function runStartStop() {
    try { setResult(JSON.stringify(await apiPost(`/api/servers/${selectedServerId}/tests/start-stop`), null, 2)); await runServerDoctor(); }
    catch (e) { setResult((e as Error).message); }
  }

  useEffect(() => { loadServers(); runSystemDoctor(); }, []);
  useEffect(() => { if (selectedServerId) runServerDoctor(); }, [selectedServerId]);

  return (
    <div className="page">
      <section className="hero glass">
        <div><p className="eyebrow">VMware / TEST_SERVER</p><h1>Test Center</h1><p className="muted">Doctor Checks, Safety Tests, Backup/Restore und Start/Stop gegen eine isolierte Test-VM oder C:\\DayZServer_TEST.</p></div>
        <ServerSelect servers={servers} serverId={selectedServerId} onChange={setSelectedServerId}/>
      </section>

      <section className="two-column">
        <DoctorPanel title="System Doctor" result={systemDoctor} />
        <DoctorPanel title="Server Doctor" result={serverDoctor} />
      </section>

      <section className="two-column">
        <div className="panel glass">
          <div className="panel-title"><TestTube2 size={20}/><h2>Run tests</h2></div>
          <div className="actions">
            <button onClick={runSystemDoctor}><Stethoscope size={18}/>System Doctor</button>
            <button onClick={runServerDoctor} disabled={!selectedServerId} className="secondary"><Stethoscope size={18}/>Server Doctor</button>
            <button onClick={runSafety} disabled={!selectedServerId}><ShieldCheck size={18}/>Safety Test</button>
            <button onClick={runStartStop} disabled={!selectedServerId} className="secondary"><Play size={18}/>Start/Stop Test</button>
          </div>
          <p className="muted">Start/Stop nur ausführen, wenn Port, Mission und Testserver wirklich isoliert sind.</p>
        </div>
        <div className="panel glass"><h2>Result</h2><pre className="logbox">{result || "No test run yet."}</pre></div>
      </section>
    </div>
  );
}
