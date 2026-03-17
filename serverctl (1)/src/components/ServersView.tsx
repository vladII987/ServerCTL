import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Terminal, 
  RefreshCw, 
  Power,
  ChevronDown,
  LayoutGrid,
  List,
  Server
} from 'lucide-react';
import { ServerData } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface ServersViewProps {
  servers: ServerData[];
}

export const ServersView = ({ servers }: ServersViewProps) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [search, setSearch] = useState('');

  const filteredServers = servers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.ip.includes(search)
  );

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold mono-text">Servers</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" 
              placeholder="Search servers..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#111] border border-white/5 rounded-lg pl-10 pr-4 py-2 text-sm mono-text focus:outline-none focus:border-emerald-500/50 w-64"
            />
          </div>
          <div className="flex bg-[#111] border border-white/5 rounded-lg p-1">
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-1.5 rounded", viewMode === 'list' ? "bg-white/5 text-white" : "text-zinc-500")}
            >
              <List size={16} />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-1.5 rounded", viewMode === 'grid' ? "bg-white/5 text-white" : "text-zinc-500")}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <button className="bg-emerald-500 text-black px-4 py-2 rounded-lg text-sm font-bold mono-text hover:bg-emerald-400">
            Add Server
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-zinc-500 mono-text">
                <th className="px-6 py-4 font-bold">Server</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">OS</th>
                <th className="px-6 py-4 font-bold">Usage</th>
                <th className="px-6 py-4 font-bold">Updates</th>
                <th className="px-6 py-4 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredServers.map((server) => (
                <tr key={server.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-white/5 text-zinc-400">
                        <Server size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-medium mono-text">{server.name}</div>
                        <div className="text-[10px] text-zinc-500 mono-text">{server.ip}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", server.status === 'online' ? "bg-emerald-500" : "bg-zinc-600")} />
                      <span className={cn("text-xs mono-text", server.status === 'online' ? "text-emerald-500" : "text-zinc-500")}>
                        {server.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-zinc-400 mono-text">{server.os}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-zinc-500 mono-text uppercase">CPU {server.cpu}%</span>
                        <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${server.cpu}%` }} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-zinc-500 mono-text uppercase">RAM {server.ram}%</span>
                        <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${server.ram}%` }} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {server.updates > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold mono-text">
                        {server.updates} PENDING
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-600 mono-text">UP TO DATE</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 hover:bg-white/10 rounded text-zinc-400" title="Terminal">
                        <Terminal size={14} />
                      </button>
                      <button className="p-1.5 hover:bg-white/10 rounded text-zinc-400" title="Update">
                        <RefreshCw size={14} />
                      </button>
                      <button className="p-1.5 hover:bg-white/10 rounded text-zinc-400" title="Power">
                        <Power size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServers.map((server) => (
            <div key={server.id} className="bg-[#111] border border-white/5 p-6 rounded-xl hover:border-emerald-500/30 transition-all group">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/5 text-zinc-400">
                    <Server size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold mono-text">{server.name}</h3>
                    <p className="text-[10px] text-zinc-500 mono-text">{server.ip}</p>
                  </div>
                </div>
                <div className={cn("px-2 py-0.5 rounded text-[9px] font-bold mono-text uppercase", 
                  server.status === 'online' ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-800 text-zinc-500")}>
                  {server.status}
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex justify-between text-[10px] mono-text mb-1">
                    <span className="text-zinc-500 uppercase tracking-wider">CPU Usage</span>
                    <span className="text-white">{server.cpu}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${server.cpu}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mono-text mb-1">
                    <span className="text-zinc-500 uppercase tracking-wider">RAM Usage</span>
                    <span className="text-white">{server.ram}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${server.ram}%` }} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="text-[10px] text-zinc-500 mono-text">{server.os}</div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-white/5 rounded text-zinc-400"><Terminal size={14} /></button>
                  <button className="p-2 hover:bg-white/5 rounded text-zinc-400"><RefreshCw size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
