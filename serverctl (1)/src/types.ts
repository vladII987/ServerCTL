export interface ServerData {
  id: string;
  name: string;
  ip: string;
  os: string;
  status: 'online' | 'offline';
  cpu: number;
  ram: number;
  disk: number;
  updates: number;
  agentVersion: string;
}

export interface DashboardStats {
  total: number;
  online: number;
  updates: number;
  compliance: number;
  osDistribution: { name: string; value: number }[];
}

export type View = 'landing' | 'dashboard' | 'servers' | 'agents' | 'networks' | 'logs' | 'shell' | 'updates' | 'settings';
