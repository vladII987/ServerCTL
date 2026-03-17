/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ServersView } from './components/ServersView';
import { TerminalView } from './components/TerminalView';
import { ServerData, DashboardStats, View } from './types';
import { 
  Server, 
  Shield, 
  Terminal, 
  Activity, 
  Package, 
  Settings, 
  Network, 
  FileText, 
  Cpu, 
  Layers, 
  CheckCircle2, 
  Github, 
  ChevronRight,
  Monitor,
  Zap,
  Menu,
  X,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Landing Page Component
const LandingPage = ({ onEnterDashboard }: { onEnterDashboard: () => void }) => {
  const Nav = () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-500 p-1.5 rounded">
                <Server className="w-5 h-5 text-black" />
              </div>
              <span className="text-xl font-bold tracking-tight mono-text">ServerCTL</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">Features</a>
              <button onClick={onEnterDashboard} className="text-sm text-emerald-500 hover:text-emerald-400 transition-colors font-medium">Dashboard</button>
              <a href="https://github.com/vladII987/ServerCTL" className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-200 transition-colors">
                <Github className="w-4 h-4" />
                GitHub
              </a>
            </div>
            <div className="md:hidden">
              <button onClick={() => setIsOpen(!isOpen)} className="text-zinc-400">
                {isOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
      </nav>
    );
  };

  const FeatureCard = ({ icon: Icon, title, description, items }: { icon: any, title: string, description: string, items?: string[] }) => (
    <motion.div whileHover={{ y: -5 }} className="p-6 rounded-xl bg-[#111] border border-white/5 hover:border-emerald-500/30 transition-all group">
      <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
        <Icon className="w-6 h-6 text-emerald-500" />
      </div>
      <h3 className="text-lg font-semibold mb-2 mono-text">{title}</h3>
      <p className="text-zinc-400 text-sm mb-4 leading-relaxed">{description}</p>
      {items && (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-zinc-500">
              <div className="w-1 h-1 rounded-full bg-emerald-500" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-screen grid-bg">
      <Nav />
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium mb-6 mono-text">v1.2.0 is now available</span>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">Own Your Infrastructure.</h1>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">Self-hosted server monitoring & management. No cloud. No agents phoning home. Just you and your servers, exactly where they belong.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={onEnterDashboard} className="w-full sm:w-auto bg-emerald-500 text-black px-8 py-4 rounded-lg font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 group">
                Enter Dashboard
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="w-full sm:w-auto bg-zinc-900 text-white border border-white/10 px-8 py-4 rounded-lg font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">
                <Github className="w-4 h-4" />
                View on GitHub
              </button>
            </div>
          </motion.div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full -z-10" />
      </section>
      <section id="features" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={Activity} title="Real-Time Monitoring" description="Live CPU, RAM, and disk usage per server with automatic agent registration." items={['Prometheus integration', 'Online/Offline status', 'Live metrics']} />
            <FeatureCard icon={Package} title="Update Management" description="See pending OS updates across all servers and perform bulk upgrades with one click." items={['apt, dnf, yum support', 'Reboot detection', 'Compliance overview']} />
            <FeatureCard icon={Terminal} title="Browser SSH" description="Full xterm.js terminal in your browser. No need to open SSH ports to the internet." items={['WebSocket tunneling', 'Key file upload', 'Real-time I/O']} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [collapsed, setCollapsed] = useState(false);
  const [servers, setServers] = useState<ServerData[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (view === 'landing') return;

    // Fetch initial data
    const fetchData = async () => {
      try {
        const [serversRes, statsRes] = await Promise.all([
          fetch('/api/servers'),
          fetch('/api/stats')
        ]);
        setServers(await serversRes.json());
        setStats(await statsRes.json());
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };

    fetchData();

    // Setup Socket.io
    const socket = io();
    socket.on('metrics', (updatedServers: ServerData[]) => {
      setServers(updatedServers);
    });

    return () => {
      socket.disconnect();
    };
  }, [view]);

  if (view === 'landing') {
    return <LandingPage onEnterDashboard={() => setView('dashboard')} />;
  }

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-[#E4E3E0] overflow-hidden">
      <Sidebar 
        currentView={view} 
        onViewChange={setView} 
        collapsed={collapsed} 
        setCollapsed={setCollapsed} 
      />
      
      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-30 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/5 h-16 flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold mono-text capitalize">{view}</h1>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 mono-text uppercase tracking-widest">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              System Live
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-white/5 rounded-full text-zinc-400 relative">
              <Package size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full border-2 border-[#0A0A0A]" />
            </button>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold mono-text">admin</div>
                <div className="text-[10px] text-zinc-500 mono-text">Super Admin</div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-black font-bold text-xs">
                AD
              </div>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-[calc(100vh-64px)]"
          >
            {view === 'dashboard' && <DashboardView stats={stats} servers={servers} />}
            {view === 'servers' && <ServersView servers={servers} />}
            {view === 'shell' && <TerminalView />}
            {['agents', 'networks', 'logs', 'updates', 'settings'].includes(view) && (
              <div className="p-8 flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6 text-zinc-500">
                  <Settings size={32} />
                </div>
                <h2 className="text-xl font-bold mono-text mb-2">Module Under Construction</h2>
                <p className="text-zinc-500 max-w-xs mono-text text-sm">
                  The {view} module is currently being implemented. Check back soon.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
