import { Activity, AlertTriangle, Archive, BarChart3, Bell, Bot, CalendarClock, Calculator, Database, DownloadCloud, FileText, HardDrive, KeyRound, Map, MessageSquare, Package, PlusCircle, Power, Radio, Rocket, ScrollText, ServerCog, ShieldCheck, TestTube2, Trash2 } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Security } from "../pages/Security";
import { apiGet, getApiKey } from "../lib/api";
import type { ServerRecord } from "../lib/types";

const AddExistingServer = lazy(() => import("../pages/AddExistingServer").then((module) => ({ default: module.AddExistingServer })));
const AdvancedLab = lazy(() => import("../pages/AdvancedLab").then((module) => ({ default: module.AdvancedLab })));
const Analytics = lazy(() => import("../pages/Analytics").then((module) => ({ default: module.Analytics })));
const AuditLog = lazy(() => import("../pages/AuditLog").then((module) => ({ default: module.AuditLog })));
const Backups = lazy(() => import("../pages/Backups").then((module) => ({ default: module.Backups })));
const CrashMonitor = lazy(() => import("../pages/CrashMonitor").then((module) => ({ default: module.CrashMonitor })));
const CommunityOps = lazy(() => import("../pages/CommunityOps").then((module) => ({ default: module.CommunityOps })));
const ContentTools = lazy(() => import("../pages/ContentTools").then((module) => ({ default: module.ContentTools })));
const Dashboard = lazy(() => import("../pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const DebugBundle = lazy(() => import("../pages/DebugBundle").then((module) => ({ default: module.DebugBundle })));
const EconomyEditor = lazy(() => import("../pages/EconomyEditor").then((module) => ({ default: module.EconomyEditor })));
const Mods = lazy(() => import("../pages/Mods").then((module) => ({ default: module.Mods })));
const ModUpdater = lazy(() => import("../pages/ModUpdater").then((module) => ({ default: module.ModUpdater })));
const LiveLogs = lazy(() => import("../pages/LiveLogs").then((module) => ({ default: module.LiveLogs })));
const Notifications = lazy(() => import("../pages/Notifications").then((module) => ({ default: module.Notifications })));
const RconAdmin = lazy(() => import("../pages/RconAdmin").then((module) => ({ default: module.RconAdmin })));
const Readiness = lazy(() => import("../pages/Readiness").then((module) => ({ default: module.Readiness })));
const Scheduler = lazy(() => import("../pages/Scheduler").then((module) => ({ default: module.Scheduler })));
const ServerControl = lazy(() => import("../pages/ServerControl").then((module) => ({ default: module.ServerControl })));
const ServerUpdater = lazy(() => import("../pages/ServerUpdater").then((module) => ({ default: module.ServerUpdater })));
const ServerConfig = lazy(() => import("../pages/ServerConfig").then((module) => ({ default: module.ServerConfig })));
const TestCenter = lazy(() => import("../pages/TestCenter").then((module) => ({ default: module.TestCenter })));
const WipeManagement = lazy(() => import("../pages/WipeManagement").then((module) => ({ default: module.WipeManagement })));

type PageKey = "dashboard" | "server-control" | "server-updater" | "mod-updater" | "community" | "content-tools" | "wipe" | "security" | "add-server" | "readiness" | "config" | "economy" | "mods" | "backups" | "audit" | "scheduler" | "notifications" | "rcon" | "crash" | "live-logs" | "tests" | "debug" | "analytics" | "advanced";

const pages = [
  ["dashboard", Activity, "Dashboard"],
  ["server-control", Power, "Server Control"],
  ["server-updater", ServerCog, "Server Updater"],
  ["mod-updater", DownloadCloud, "Mod Updater"],
  ["community", MessageSquare, "Community Ops"],
  ["content-tools", Calculator, "Content Tools"],
  ["wipe", Trash2, "Wipe Management"],
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
  const [version, setVersion] = useState("");

  useEffect(() => {
    apiGet<{ version?: string }>("/health").then((health) => setVersion(health.version ?? "")).catch(() => setVersion(""));
  }, []);

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
    if (page === "community") return <CommunityOps {...props} />;
    if (page === "content-tools") return <ContentTools {...props} />;
    if (page === "wipe") return <WipeManagement {...props} />;
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
          <div><strong>DayZ AIO</strong><span>Control Plane{version ? ` v${version}` : ""}</span></div>
        </div>
        {!hasApiKey ? <div className="mini-note danger-note"><KeyRound size={16} /> API-Key fehlt</div> : null}
        <nav>
          {pages.map(([key, Icon, label]) => (
            <button key={key} className={page === key ? "active" : ""} onClick={() => setPage(key)}><Icon size={18} />{label}</button>
          ))}
        </nav>
        <div className="mini-note"><Map size={16} /> Browser Panel + Windows Backend</div>
      </aside>
      <section className="content"><Suspense fallback={<p className="muted">Loading…</p>}>{renderPage()}</Suspense></section>
    </main>
  );
}
