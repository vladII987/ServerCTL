import React from 'react';
import { 
  LayoutDashboard, 
  Server, 
  ShieldCheck, 
  Network, 
  FileText, 
  Terminal, 
  RefreshCw, 
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { View } from '@/src/types';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const Sidebar = ({ currentView, onViewChange, collapsed, setCollapsed }: SidebarProps) => {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'servers', icon: Server, label: 'Servers' },
    { id: 'agents', icon: ShieldCheck, label: 'Agents' },
    { id: 'networks', icon: Network, label: 'Networks' },
    { id: 'logs', icon: FileText, label: 'Logs' },
    { id: 'shell', icon: Terminal, label: 'Shell' },
    { id: 'updates', icon: RefreshCw, label: 'Updates' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className={cn(
      "bg-[#0F0F0F] border-r border-white/5 transition-all duration-300 flex flex-col",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="p-4 flex items-center justify-between border-b border-white/5 h-16">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 p-1 rounded">
              <Server className="w-4 h-4 text-black" />
            </div>
            <span className="font-bold tracking-tight mono-text">ServerCTL</span>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-white/5 rounded text-zinc-500"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id as View)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm mono-text",
              currentView === item.id 
                ? "bg-emerald-500/10 text-emerald-500" 
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <item.icon size={18} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <button 
          onClick={() => onViewChange('landing')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-400/5 transition-colors text-sm mono-text",
            collapsed && "justify-center"
          )}
        >
          <LogOut size={18} />
          {!collapsed && <span>Exit Dashboard</span>}
        </button>
      </div>
    </aside>
  );
};
