export type ServerRecord = {
  id: string;
  name: string;
  rootPath: string;
  profilePath: string;
  executablePath: string;
  missionPath: string;
  launchParams: string;
  rconHost?: string | null;
  rconPort?: number | null;
  steamcmdPath?: string | null;
  workshopAppId?: string;
};

export type RuntimeStatus = {
  serverId: string;
  status: string;
  pid?: number | null;
  pidAlive?: boolean;
  inMemoryRunning?: boolean;
  lastStartedAt?: string;
  lastStoppedAt?: string;
  logLines?: number;
};

export type BackupRecord = {
  id: string;
  serverId: string;
  type: string;
  path: string;
  reason: string;
  createdAt: string;
};

export type AuditItem = {
  id: string;
  serverId?: string;
  actor: string;
  action: string;
  target: string;
  metadata?: unknown;
  createdAt: string;
};

export type DayzTypeItem = {
  name: string;
  nominal: number;
  lifetime: number;
  restock: number;
  min: number;
  quantmin: number;
  quantmax: number;
  cost: number;
  flags: {
    countInCargo: boolean;
    countInHoarder: boolean;
    countInMap: boolean;
    countInPlayer: boolean;
    crafted: boolean;
    deloot: boolean;
  };
  category?: string;
  usage: string[];
  value: string[];
};

export type DiffLine = { type: "same" | "add" | "remove"; line: string; oldLine?: number; newLine?: number };
