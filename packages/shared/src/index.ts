export type ServerStatus = "stopped" | "starting" | "running" | "stopping" | "crashed" | "unknown";

export type DayzServer = {
  id: string;
  name: string;
  rootPath: string;
  profilePath: string;
  executablePath: string;
  launchParams: string;
  createdAt: string;
  updatedAt: string;
};

export type DayzTypeEntry = {
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

export type BackupEntry = {
  id: string;
  serverId: string;
  type: "manual" | "config" | "economy" | "mods" | "restart";
  path: string;
  reason: string;
  createdAt: string;
};
