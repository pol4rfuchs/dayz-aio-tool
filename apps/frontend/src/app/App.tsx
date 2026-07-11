import { Activity, AlertTriangle, Archive, BarChart3, Bell, Bot, CalendarClock, Database, DownloadCloud, FileText, HardDrive, KeyRound, Map, Package, PlusCircle, Power, Radio, Rocket, ScrollText, ServerCog, ShieldCheck, TestTube2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AddExistingServer } from "../pages/AddExistingServer";
import { AdvancedLab } from "../pages/AdvancedLab";
import { Analytics } from "../pages/Analytics";
import { AuditLog } from "../pages/AuditLog";
import { Backups } from "../pages/Backups";
import { CrashMonitor } from "../pages/CrashMonitor";
import { Dashboard } from "../pages/Dashboard";
import { DebugBundle } from "../pages/DebugBundle";
import { EconomyEditor } from "../pages/EconomyEditor";
import { Mods } from "../pages/Mods";
import { ModUpdater } from "../pages/ModUpdater";
import { LiveLogs } from "../pages/LiveLogs";
import { Notifications } from "../pages/Notifications";
import { RconAdmin } from "../pages/RconAdmin";
import { Readiness } from "../pages/Readiness";
import { Scheduler } from "../pages/Scheduler";
import { Security } from "../pages/Security";
import { ServerControl } from "../pages/ServerControl";
import { ServerUpdater } from "../pages/ServerUpdater";
import { ServerConfig } from "../pages/ServerConfig";
import { TestCenter } from "../pages/TestCenter";
import { apiGet, getApiKey } from "../lib/api";
import type { ServerRecord } from "../lib/types";

type PageKey = "dashboard" | "server-control" | "server-updater" | "mod-updater" | "security" | "add-server" | "readiness" | "config" | "economy" | "mods" | "backups" | "audit" | "scheduler" | "notifications" | "rcon" | "crash" | "live-logs" | "tests" | "debug" | "analytics" | "advanced";

const pages = [
  ["dashboard", Activity, "Dashboard"],
  ["server-control", Power, "Server Control"],
  ["server-updater", ServerCog, "Server Updater"],
  ["mod-updater", DownloadCloud, "Mod Updater"],
  ["security", KeyRound, "Security"],
  ["add-server", PlusCircle, "Add Existing Server"],
  ["readiness", Rocket, "Go-Live Checklist"],
  ["config", FileText, "Config"],
  ["economy", Database, "Economy"],
  ["mods", Package, "Mods"],
  ["backups", HardDrive, "Backups"],
  ["audit", ShieldCheck, "Audit"],
  ["scheduler", CalendarClock, "Scheduler"],
  ["notifications", Bell, "Notifications"],
  ["rcon", Radio, "RCON/Admin"],
  ["crash", AlertTriangle, "Crash Intelligence"],
  ["live-logs", ScrollText, "Live Logs"],
  ["tests", TestTube2, "Test Center"],
  ["debug", Archive, "Debug Bundle"],
  ["analytics", BarChart3, "Analytics"],
  ["advanced", Bot, "Advanced Lab"]
] as const;

function readRoute() {
  const query = new URLSearchParams(window.location.search);
  return {
    page: (query.get("page") || "dashboard") as PageKey,
    serverId: query.get("server") || localStorage.getItem("dayz-aio.selectedServerId") || ""
  };
}

function writeRoute(page: PageKey, serverId: string) {
  const query = new URLSearchParams();
  if (page !== "dashboard") query.set("page", page);
  if (serverId) query.set("server", serverId);
  const next = `${window.location.pathname}${query.toString() ? `?${query}` : ""}`;
  window.history.replaceState(null, "", next);
}

export function App() {
  const initial = useMemo(readRoute, []);
  const [page, setPageState] = useState<PageKey>(initial.page);
  const [selectedServerId, setSelectedServerIdState] = useState(initial.serverId);
  const [hasApiKey, setHasApiKey] = useState(Boolean(getApiKey()));

  useEffect(() => {
    if (!hasApiKey) return;
    let cancelled = false;
    apiGet<ServerRecord[]>("/api/servers")
      .then((servers) => {
        if (cancelled) return;
        const hasSelected = Boolean(selectedServerId) && servers.some((server) => server.id === selectedServerId);
        if ((!selectedServerId && servers[0]) || (selectedServerId && !hasSelected)) {
          const fallback = servers[0]?.id ?? "";
          setSelectedServerIdState(fallback);
          if (fallback) localStorage.setItem("dayz-aio.selectedServerId", fallback);
          else localStorage.removeItem("dayz-aio.selectedServerId");
        }
      })
      .catch(() => {
        // Keep current selection when the server list cannot be checked yet.
      });
    return () => { cancelled = true; };
  }, [hasApiKey, selectedServerId]);

  useEffect(() => {
    if (selectedServerId) localStorage.setItem("dayz-aio.selectedServerId", selectedServerId);
    else localStorage.removeItem("dayz-aio.selectedServerId");
    writeRoute(page, selectedServerId);
  }, [page, selectedServerId]);

  function setPage(next: PageKey) { setPageState(next); }
  function setSelectedServerId(next: string) { setSelectedServerIdState(next); }

  function renderPage() {
    const props = { selectedServerId, setSelectedServerId };
    if (page === "security") return <Security onSaved={() => { setHasApiKey(Boolean(getApiKey())); setPage("dashboard"); }} />;
    if (!hasApiKey) return <Security onSaved={() => { setHasApiKey(Boolean(getApiKey())); setPage("dashboard"); }} />;
    if (page === "dashboard") return <Dashboard {...props} />;
    if (page === "server-control") return <ServerControl {...props} />;
    if (page === "server-updater") return <ServerUpdater {...props} />;
    if (page === "mod-updater") return <ModUpdater {...props} />;
    if (page === "add-server") return <AddExistingServer onCreated={(id) => { setSelectedServerId(id); setPage("readiness"); }} />;
    if (page === "readiness") return <Readiness {...props} />;
    if (page === "config") return <ServerConfig {...props} />;
    if (page === "economy") return <EconomyEditor {...props} />;
    if (page === "mods") return <Mods {...props} />;
    if (page === "backups") return <Backups {...props} />;
    if (page === "audit") return <AuditLog {...props} />;
    if (page === "scheduler") return <Scheduler {...props} />;
    if (page === "notifications") return <Notifications />;
    if (page === "rcon") return <RconAdmin {...props} />;
    if (page === "crash") return <CrashMonitor {...props} />;
    if (page === "live-logs") return <LiveLogs {...props} />;
    if (page === "tests") return <TestCenter {...props} />;
    if (page === "debug") return <DebugBundle />;
    if (page === "analytics") return <Analytics {...props} />;
    return <AdvancedLab {...props} />;
  }

  return (
    <main className="shell">
      <aside className="sidebar glass">
        <div className="brand">
          <div className="brand-mark">DZ</div>
          <div><strong>DayZ AIO</strong><span>Control Plane v0.4.1-beta-hardening</span></div>
        </div>
        {!hasApiKey ? <div className="mini-note danger-note"><KeyRound size={16} /> API-Key fehlt</div> : null}
        <nav>
          {pages.map(([key, Icon, label]) => (
            <button key={key} className={page === key ? "active" : ""} onClick={() => setPage(key)}><Icon size={18} />{label}</button>
          ))}
        </nav>
        <div className="mini-note"><Map size={16} /> Browser Panel + Windows Backend</div>
      </aside>
      <section className="content">{renderPage()}</section>
    </main>
  );
}
