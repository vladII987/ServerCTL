import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import 'xterm/css/xterm.css';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2 } from 'lucide-react';

export const TerminalView = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#0F0F0F',
        foreground: '#E4E3E0',
        cursor: '#10b981',
        selectionBackground: 'rgba(16, 185, 129, 0.3)',
      },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 14,
      lineHeight: 1.4,
    });

    term.open(terminalRef.current);
    term.writeln('\x1b[1;32mServerCTL SSH Proxy v1.2.0\x1b[0m');
    term.writeln('Connecting to \x1b[1;36mweb-prod-01\x1b[0m (192.168.1.10)...');
    term.writeln('Authenticating with agent token...');
    term.writeln('\x1b[1;32mConnection established.\x1b[0m');
    term.writeln('');
    term.write('serverctl@web-prod-01:~$ ');

    term.onData((data) => {
      if (data === '\r') {
        term.write('\r\nserverctl@web-prod-01:~$ ');
      } else if (data === '\u007f') { // Backspace
        term.write('\b \b');
      } else {
        term.write(data);
      }
    });

    xtermRef.current = term;

    return () => {
      term.dispose();
    };
  }, []);

  return (
    <div className="p-8 h-full flex flex-col space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <TerminalIcon size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold mono-text">Terminal</h2>
            <p className="text-[10px] text-zinc-500 mono-text uppercase tracking-wider">Connected to web-prod-01</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-white/5 rounded text-zinc-500"><Minimize2 size={16} /></button>
          <button className="p-2 hover:bg-white/5 rounded text-zinc-500"><Maximize2 size={16} /></button>
          <button className="p-2 hover:bg-white/5 rounded text-zinc-500"><X size={16} /></button>
        </div>
      </div>

      <div className="flex-1 bg-[#0F0F0F] border border-white/5 rounded-xl overflow-hidden p-4 shadow-2xl">
        <div ref={terminalRef} className="h-full w-full" />
      </div>

      <div className="bg-[#111] border border-white/5 p-4 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-[10px] text-zinc-500 mono-text uppercase">Session: <span className="text-white">active</span></div>
          <div className="text-[10px] text-zinc-500 mono-text uppercase">Latency: <span className="text-emerald-500">12ms</span></div>
        </div>
        <div className="text-[10px] text-zinc-500 mono-text uppercase">Press <kbd className="bg-white/10 px-1 rounded text-white">Ctrl+C</kbd> to terminate</div>
      </div>
    </div>
  );
};
