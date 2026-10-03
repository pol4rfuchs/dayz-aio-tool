CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL,
  profile_path TEXT NOT NULL,
  executable_path TEXT NOT NULL,
  mission_path TEXT NOT NULL DEFAULT '',
  launch_params TEXT NOT NULL DEFAULT '',
  rcon_host TEXT,
  rcon_port INTEGER,
  rcon_password TEXT,
  steamcmd_path TEXT,
  workshop_app_id TEXT NOT NULL DEFAULT '221100',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS server_state (
  server_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'stopped',
  pid INTEGER,
  last_started_at TEXT,
  last_stopped_at TEXT,
  last_heartbeat_at TEXT,
  FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mods (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  folder_name TEXT NOT NULL,
  display_name TEXT,
  workshop_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  load_order INTEGER NOT NULL DEFAULT 0,
  has_keys INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  name TEXT NOT NULL,
  action TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  interval_minutes INTEGER,
  at_time TEXT,
  last_run_at TEXT,
  next_run_at TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_targets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  topic TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS wipe_cycles (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  name TEXT NOT NULL,
  storage_name TEXT NOT NULL,
  archived_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Indexes for the list/sort queries used by the UI (audit log, backups, mods, schedules, tests, wipes).
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_server_created ON audit_log (server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_server_created ON backups (server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mods_server_order ON mods (server_id, load_order, folder_name);
CREATE INDEX IF NOT EXISTS idx_schedules_server ON schedules (server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedules_due ON schedules (enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_test_runs_server_created ON test_runs (server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wipe_cycles_server_created ON wipe_cycles (server_id, created_at DESC);
