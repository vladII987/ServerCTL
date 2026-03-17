import React from 'react';
import { 
  Server, 
  Activity, 
  ShieldCheck, 
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { DashboardStats, ServerData } from '@/src/types';

interface DashboardViewProps {
  stats: DashboardStats | null;
  servers: ServerData[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export const DashboardView = ({ stats, servers }: DashboardViewProps) => {
  if (!stats) return <div className="p-8 text-zinc-500 mono-text">Loading stats...</div>;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold mono-text">Fleet Overview</h2>
        <div className="text-xs text-zinc-500 mono-text">Last updated: Just now</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Servers', value: stats.total, icon: Server, color: 'text-blue-500' },
          { label: 'Online Now', value: stats.online, icon: Activity, color: 'text-emerald-500' },
          { label: 'Pending Updates', value: stats.updates, icon: RefreshCw, color: 'text-amber-500' },
          { label: 'Compliance', value: `${stats.compliance}%`, icon: ShieldCheck, color: 'text-purple-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#111] border border-white/5 p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-500 mono-text">
                <ArrowUpRight size={12} />
                +2.4%
              </div>
            </div>
            <div className="text-2xl font-bold mono-text mb-1">{stat.value}</div>
            <div className="text-xs text-zinc-500 uppercase tracking-wider mono-text">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* OS Distribution */}
        <div className="lg:col-span-1 bg-[#111] border border-white/5 p-6 rounded-xl">
          <h3 className="text-sm font-bold mb-6 mono-text uppercase tracking-widest text-zinc-400">OS Distribution</h3>
          <div className="h-64">
            {stats.osDistribution && stats.osDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={stats.osDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.osDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontFamily: 'JetBrains Mono' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500 text-xs mono-text">
                No data available
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {stats.osDistribution.map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-xs mono-text">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-zinc-400">{entry.name}</span>
                </div>
                <span className="text-white">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity / Server Health */}
        <div className="lg:col-span-2 bg-[#111] border border-white/5 p-6 rounded-xl">
          <h3 className="text-sm font-bold mb-6 mono-text uppercase tracking-widest text-zinc-400">Server Health</h3>
          <div className="space-y-4">
            {servers.slice(0, 5).map((server) => (
              <div key={server.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className={server.status === 'online' ? 'text-emerald-500' : 'text-zinc-600'}>
                    <Server size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-medium mono-text">{server.name}</div>
                    <div className="text-[10px] text-zinc-500 mono-text">{server.ip} • {server.os}</div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="hidden sm:block">
                    <div className="text-[10px] text-zinc-500 mono-text mb-1 uppercase">CPU</div>
                    <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-500" 
                        style={{ width: `${server.cpu}%` }} 
                      />
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-[10px] text-zinc-500 mono-text mb-1 uppercase">RAM</div>
                    <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-500" 
                        style={{ width: `${server.ram}%` }} 
                      />
                    </div>
                  </div>
                  <div className={server.status === 'online' ? 'text-emerald-500' : 'text-red-500'}>
                    <div className="text-[10px] mono-text uppercase font-bold">{server.status}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
