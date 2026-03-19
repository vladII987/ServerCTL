import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import RFB from './novnc/rfb.js';

const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_HOST = `${WS_PROTOCOL}//${window.location.host}`;

// ─── Resizable modal wrapper ────────────────────────────────────
const ResizableModal = ({ style, children, onClick }) => {
  const ref = useRef(null);
  const drag = useRef(null);

  const onMouseDown = useCallback((edge) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    const startX = e.clientX, startY = e.clientY;
    const startW = el.offsetWidth, startH = el.offsetHeight;
    drag.current = { edge, startX, startY, startW, startH };

    const onMove = (ev) => {
      if (!drag.current) return;
      const dx = ev.clientX - drag.current.startX;
      const dy = ev.clientY - drag.current.startY;
      if (drag.current.edge === 'right' || drag.current.edge === 'corner')
        el.style.width = Math.max(480, drag.current.startW + dx) + 'px';
      if (drag.current.edge === 'bottom' || drag.current.edge === 'corner')
        el.style.height = Math.max(300, drag.current.startH + dy) + 'px';
    };
    const onUp = () => {
      drag.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const handleStyle = (edge) => {
    const base = { position: 'absolute', zIndex: 10 };
    if (edge === 'right')  return { ...base, top: 20, right: 0, width: 6, bottom: 20, cursor: 'ew-resize' };
    if (edge === 'bottom') return { ...base, left: 20, bottom: 0, height: 6, right: 20, cursor: 'ns-resize' };
    if (edge === 'corner') return { ...base, right: 0, bottom: 0, width: 16, height: 16, cursor: 'nwse-resize' };
  };

  const lineStyle = (edge) => {
    const base = { position: 'absolute', background: 'var(--color-primary)', opacity: 0, transition: 'opacity 0.15s', borderRadius: 3 };
    if (edge === 'right')  return { ...base, top: '10%', right: 1, width: 3, height: '80%' };
    if (edge === 'bottom') return { ...base, left: '10%', bottom: 1, height: 3, width: '80%' };
    if (edge === 'corner') return { ...base, right: 2, bottom: 2, width: 10, height: 10,
      borderRight: '2px solid var(--color-primary)', borderBottom: '2px solid var(--color-primary)',
      background: 'none', opacity: 0.4 };
  };

  const addHover = (edge) => (e) => {
    e.currentTarget.querySelector('.line').style.opacity = '0.6';
  };
  const rmHover = (e) => {
    e.currentTarget.querySelector('.line').style.opacity = edge === 'corner' ? '0.4' : '0';
  };

  return (
    <div ref={ref} style={{ ...style, position: 'relative', resize: 'none' }} onClick={onClick}>
      {['right', 'bottom', 'corner'].map(edge => (
        <div key={edge} style={handleStyle(edge)}
          onMouseDown={onMouseDown(edge)}
          onMouseEnter={addHover(edge)}
          onMouseLeave={rmHover}>
          <div className="line" style={lineStyle(edge)} />
        </div>
      ))}
      {children}
    </div>
  );
};


// ─── Login page ────────────────────────────────────────────────
const LoginPage = ({ onLogin, darkMode, toggleDark }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok) { setError((await r.json()).detail || 'Login failed'); setLoading(false); return; }
      const data = await r.json();
      onLogin(data);
    } catch { setError('Server unreachable'); }
    setLoading(false);
  };

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Plus Jakarta Sans", sans-serif', color: 'var(--text-primary)', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        .login-input { font-family: "Plus Jakarta Sans", sans-serif !important; font-size: 14px !important; }
        .login-input:focus { border-color: var(--color-primary) !important; box-shadow: 0 0 0 3px var(--color-primary-ring) !important; outline: none; }
        .login-btn:hover:not(:disabled) { background: #4f9cf9 !important; box-shadow: 0 8px 24px rgba(79,156,249,0.35) !important; transform: translateY(-1px); }
        .login-btn:active:not(:disabled) { transform: translateY(0) !important; }
        .login-btn { transition: all 0.2s cubic-bezier(0.4,0,0.2,1) !important; }
      `}</style>

      {/* Ambient background blobs */}
      <div className={darkMode ? 'grid-bg-dark' : 'grid-bg-light'} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(79,156,249,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-15%', left: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '420px', padding: '0 24px', position: 'relative', zIndex: 1, animation: 'fadeIn 0.4s ease-out' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', background: 'linear-gradient(135deg, #4f9cf9, #a78bfa)', borderRadius: '14px', marginBottom: '16px', boxShadow: '0 8px 24px rgba(79,156,249,0.3)' }}>
            <span style={{ fontSize: '22px', color: '#fff' }}>◈</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            Server<span style={{ color: '#4f9cf9' }}>CTL</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '5px', fontWeight: '400' }}>
            Infrastructure management platform
          </div>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '32px', borderRadius: '18px', boxShadow: darkMode ? '0 24px 60px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05) inset' : '0 20px 50px rgba(0,0,0,0.1)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>

          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.02em' }}>Welcome back</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '28px' }}>Sign in to your account to continue</div>

          <form onSubmit={submit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '7px', color: 'var(--text-secondary)' }}>Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} autoFocus required className="login-input"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', borderRadius: '10px', boxSizing: 'border-box', transition: 'all 0.2s ease', lineHeight: '1.5' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '7px', color: 'var(--text-secondary)' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="login-input"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', borderRadius: '10px', boxSizing: 'border-box', transition: 'all 0.2s ease', lineHeight: '1.5' }} />
            </div>
            {error && (
              <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', padding: '11px 14px', marginBottom: '16px', fontSize: '13px', borderRadius: '10px', fontWeight: '500' }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="login-btn"
              style={{ width: '100%', padding: '12px', border: 'none', background: '#4f9cf9', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', borderRadius: '10px', boxShadow: '0 4px 16px rgba(79,156,249,0.25)', letterSpacing: '-0.01em' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button onClick={toggleDark} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
            {darkMode ? '☀ Light mode' : '🌙 Dark mode'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Donut chart ───────────────────────────────────────────────
const DonutChart = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  let angle = -Math.PI / 2;
  const cx = 70, cy = 70, r = 52, inner = 30;
  const paths = data.map(d => {
    const a = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + a), y2 = cy + r * Math.sin(angle + a);
    const xi1 = cx + inner * Math.cos(angle), yi1 = cy + inner * Math.sin(angle);
    const xi2 = cx + inner * Math.cos(angle + a), yi2 = cy + inner * Math.sin(angle + a);
    const lg = a > Math.PI ? 1 : 0;
    const path = `M${x1} ${y1} A${r} ${r} 0 ${lg} 1 ${x2} ${y2} L${xi2} ${yi2} A${inner} ${inner} 0 ${lg} 0 ${xi1} ${yi1}Z`;
    angle += a;
    return { ...d, path };
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        {paths.map((p, i) => <path key={i} d={p.path} fill={p.color} />)}
        <text x="70" y="66" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text-primary)">{total}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="10" fill="var(--text-muted)">servers</text>
      </svg>
      <div style={{ fontSize: '13px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: d.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-primary)' }}>{d.label}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', paddingLeft: '12px' }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── NoVNCDisplay: RDP via FreeRDP + TigerVNC + noVNC ────────────
// noVNC is served from /novnc/ (public dir) — loaded as a runtime URL
// import so Rollup never tries to resolve it at build time.
const NoVNCDisplay = React.forwardRef(({ server, username, password, domain, rdpPort, security, token, wsHost, width, height, onConnected, onDisconnected }, fwdRef) => {
  const displayRef = useRef(null);
  const rfbRef = useRef(null);

  React.useImperativeHandle(fwdRef, () => ({
    clipboardPaste: (text) => { if (rfbRef.current) rfbRef.current.clipboardPasteFrom(text); },
  }));

  useEffect(() => {
    if (!displayRef.current) return;

    const params = new URLSearchParams({
      token:    token || '',
      username: username || 'Administrator',
      password: password || '',
      domain:   domain || '',
      rdp_port: rdpPort || 3389,
      width:    width  || 1280,
      height:   height || 720,
      security: security || 'nla',
    });
    const wsUrl = `${wsHost}/ws/rdp/${server.id}?${params}`;

    try {
      const rfb = new RFB(displayRef.current, wsUrl);
      rfbRef.current = rfb;
      rfb.scaleViewport = true;
      rfb.resizeSession  = true;
      rfb.showDotCursor  = false;
      rfb.addEventListener('connect',    () => onConnected?.());
      rfb.addEventListener('disconnect', () => onDisconnected?.());
    } catch (e) {
      console.error('NoVNC RFB init failed:', e);
      onDisconnected?.();
    }

    // Ctrl+Shift+V: read local clipboard and paste into RDP session
    const handleKeyDown = async (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        e.stopPropagation();
        try {
          const text = await navigator.clipboard.readText();
          if (text && rfbRef.current) {
            rfbRef.current.clipboardPasteFrom(text);
          }
        } catch (err) {
          console.warn('Clipboard read failed (need HTTPS + permission):', err);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (rfbRef.current) {
        try { rfbRef.current.disconnect(); } catch {}
        rfbRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={displayRef} style={{ width: '100%', height: '100%', background: '#000', overflow: 'hidden' }} />;
});

// ─── XTerminal: real xterm.js SSH terminal ─────────────────────
const XTerminal = ({ server, username, authMethod, password, keyContent, token, wsHost, onConnected, onDisconnected }) => {
  const containerRef = useRef(null);
  const xtermRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    let term;
    let fitAddon;
    let resizeHandler;

    const init = async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      term = new Terminal({
        fontFamily: '"Cascadia Code", "Source Code Pro", Menlo, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.2,
        cursorBlink: true,
        scrollback: 5000,
        convertEol: false,
        theme: {
          background: '#1a1a1a',
          foreground: '#f0f0f0',
          black: '#484f58',    red: '#ff7b72',    green: '#3fb950',   yellow: '#d29922',
          blue: '#58a6ff',     magenta: '#bc8cff', cyan: '#39c5cf',   white: '#b1bac4',
          brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
          brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
          brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
          cursor: '#58a6ff', selectionBackground: 'rgba(88,166,255,0.3)',
        },
      });
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      setTimeout(() => { fitAddon.fit(); term.focus(); }, 50);
      xtermRef.current = term;

      const ws = new WebSocket(`${wsHost}/ws/ssh/${server.id}`);
      wsRef.current = ws;

      ws.onopen = () => {
        const { cols, rows } = term;
        const msg = { token, username, ssh_port: 22, method: authMethod, cols, rows };
        if (authMethod === 'password') msg.password = password;
        else if (authMethod === 'key_path') msg.key_path = password;
        else if (authMethod === 'key_upload') msg.key_data = keyContent;
        ws.send(JSON.stringify(msg));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'output') {
            term.write(msg.data);
            if (msg.data.includes('Connected') || msg.data.includes('\u2713')) onConnected?.();
          } else if (msg.type === 'error') {
            term.write(msg.data);
          }
        } catch { term.write(e.data); }
      };

      ws.onclose = () => { term.write('\r\n\x1b[31mConnection closed\x1b[0m\r\n'); onDisconnected?.(); };
      ws.onerror = () => { term.write('\r\n\x1b[31mConnection error\x1b[0m\r\n'); onDisconnected?.(); };

      term.onData(data => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }));
      });

      term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      });

      resizeHandler = () => fitAddon.fit();
      window.addEventListener('resize', resizeHandler);
    };

    init();

    return () => {
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      wsRef.current?.close();
      xtermRef.current?.dispose();
      xtermRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#1a1a1a' }} />;
};


const Dashboard = () => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('serverctl_user')); } catch { return null; }
  });
  const [servers, setServers] = useState([]);
  const [hostStatus, setHostStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualHost, setManualHost] = useState("");
  const [manualName, setManualName] = useState("");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') !== 'false');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const toggleSidebar = () => setSidebarCollapsed(v => { localStorage.setItem('sidebarCollapsed', !v); return !v; });
  React.useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    const bg = darkMode ? '#0f1117' : '#f0f2f8';
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
    document.body.style.margin = '0';
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    document.documentElement.style.setProperty('--scrollbar-track', 'transparent');
    document.documentElement.style.setProperty('--scrollbar-thumb', darkMode ? 'rgba(0,212,255,0.12)' : 'rgba(0,160,200,0.15)');
    document.documentElement.style.setProperty('--color-scheme', darkMode ? 'dark' : 'light');
  }, [darkMode]);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [btnHover, setBtnHover] = useState(null);
  const [inputFocus, setInputFocus] = useState(null);
  const [selectedServer, setSelectedServer] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [tabHover, setTabHover] = useState(null);
  const [metrics, setMetrics] = useState({});
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [sshOutput, setSshOutput] = useState('');
  const [sshInput, setSshInput] = useState('');
  const [sshConnected, setSshConnected] = useState(false);
  const [sshWs, setSshWs] = useState(null);
  const [sshUsername, setSshUsername] = useState('root');
  const [sshPassword, setSshPassword] = useState('');
  const [sshKeyContent, setSshKeyContent] = useState('');
  const [sshAuthMethod, setSshAuthMethod] = useState('password');
  const [actionOutput, setActionOutput] = useState('');
  const [actionView, setActionView] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [actionBtnHover, setActionBtnHover] = useState(null);
  const [showToken, setShowToken] = useState(null);
  const [showScan, setShowScan] = useState(false);
  const [scanSubnet, setScanSubnet] = useState('192.168.1.0/24');
  const [scanStatus, setScanStatus] = useState('');
  const [foundServers, setFoundServers] = useState([]);
  const [logsOutput, setLogsOutput] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [availableLogs, setAvailableLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [dockerContainers, setDockerContainers] = useState([]);
  const [dockerLoading, setDockerLoading] = useState(false);
  const [servicesList, setServicesList] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [serviceDetail, setServiceDetail] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [serviceFloatingOpen, setServiceFloatingOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [serverQuickFilter, setServerQuickFilter] = useState('all');
  const [selectedServers, setSelectedServers] = useState([]);
  const [bulkActionOutput, setBulkActionOutput] = useState('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState([]); // [{id, name, host, status, output}]
  const [upgradedServerIds, setUpgradedServerIds] = useState(new Set()); // servers that were just upgraded (show reboot btn)
  const [toasts, setToasts] = useState([]); // [{id, type, title, message}]
  const [globalTasks, setGlobalTasks] = useState([]); // [{id, server, command, status, output, startTime}]
  const [showTaskPanel, setShowTaskPanel] = useState(true);
  const [showDonationModal, setShowDonationModal] = useState(() => localStorage.getItem('serverctl_donated') !== 'true');
  const [showRebootConfirm, setShowRebootConfirm] = useState(false);
  const [rebootTargets, setRebootTargets] = useState([]); // [{id, name, host}] — all candidates
  const [rebootSelected, setRebootSelected] = useState(new Set()); // selected IDs
  const [rebooting, setRebooting] = useState(false);
  const [repoTestServer, setRepoTestServer] = useState('');
  const [repoTestLoading, setRepoTestLoading] = useState(false);
  const [repoTestResult, setRepoTestResult] = useState('');
  const [pingResults, setPingResults] = useState({});
  const [pingRunning, setPingRunning] = useState(false);
  const [pingSelected, setPingSelected] = useState([]);
  const [probeType, setProbeType] = useState('ping');
  const [probePort, setProbePort] = useState('');
  const [probeProto, setProbeProto] = useState('tcp');
  const [probeUrl, setProbeUrl] = useState('');
  const [probeDb, setProbeDb] = useState('mysql');
  const [networkSubTab, setNetworkSubTab] = useState('ip');
  const [networkInfoOutput, setNetworkInfoOutput] = useState('');
  const [networkInfoLoading, setNetworkInfoLoading] = useState(false);
  const [fwAction, setFwAction] = useState('allow');
  const [fwDirection, setFwDirection] = useState('in');
  const [fwProto, setFwProto] = useState('tcp');
  const [fwPort, setFwPort] = useState('');
  const [fwLoading, setFwLoading] = useState(false);
  const [fwResult, setFwResult] = useState('');
  const [networkTool, setNetworkTool] = useState('ping');
  const [networkTarget, setNetworkTarget] = useState('');
  const [networkOutput, setNetworkOutput] = useState('');
  const [networkLoading, setNetworkLoading] = useState(false);
  const networkAbortRef = useRef(null);
  const [sysInfoData, setSysInfoData] = useState(null);
  const [processesData, setProcessesData] = useState([]);
  const [serverMetricsMap, setServerMetricsMap] = useState({});
  const [updatesData, setUpdatesData] = useState(null);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const [copiedId, setCopiedId] = useState(null);
  const copyToClipboard = (text, id) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    const cid = id || 'default';
    setCopiedId(cid);
    setTimeout(() => setCopiedId(prev => prev === cid ? null : prev), 2000);
  };
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('list');
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [modalSize, setModalSize] = useState({ width: '90vw', maxWidth: '960px' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardOS, setWizardOS] = useState('linux');
  const [wizardName, setWizardName] = useState('');
  const [wizardHost, setWizardHost] = useState('');
  const [wizardGroup, setWizardGroup] = useState('');
  const [wizardServerId, setWizardServerId] = useState('');
  const wizardServerIdRef = useRef('');
  const [wizardConnected, setWizardConnected] = useState(false);
  const [wizardNewServer, setWizardNewServer] = useState(null);
  const wizardPollRef = useRef(null);
  const wizardPreServersRef = useRef([]);
  const [wizardInstallCmd, setWizardInstallCmd] = useState('');
  const [wizardInstallCmdLoading, setWizardInstallCmdLoading] = useState(false);
  const [navSection, setNavSectionRaw] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'dashboard';
  });
  const setNavSection = (section) => {
    setNavSectionRaw(section);
    window.location.hash = section;
  };
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeOutput, setUpgradeOutput] = useState('');
  // Shell & RDP section state
  const [shellMode, setShellMode] = useState('ssh'); // 'ssh' | 'rdp'
  const [shellServer, setShellServer] = useState(null);
  const [shellWs, setShellWs] = useState(null);
  const [shellConnected, setShellConnected] = useState(false);
  const [shellUsername, setShellUsername] = useState('administrator');
  const [shellPassword, setShellPassword] = useState('');
  const [shellAuthMethod, setShellAuthMethod] = useState('password');
  const [shellKeyContent, setShellKeyContent] = useState('');
  const [shellSessionKey, setShellSessionKey] = useState(0);
  // RDP-specific state
  const [rdpPort, setRdpPort] = useState('3389');
  const [rdpNla, setRdpNla] = useState(true);
  const [rdpSessionKey, setRdpSessionKey] = useState(0);
  const [rdpConnected, setRdpConnected] = useState(false);
  const [rdpWidth, setRdpWidth] = useState(1280);
  const [rdpHeight, setRdpHeight] = useState(720);
  const [rdpClipboard, setRdpClipboard] = useState(false);
  const [rdpClipText, setRdpClipText] = useState('');
  const rdpDisplayRef = useRef(null);
  // Logs section state
  const [logsServer, setLogsServer] = useState(null);
  const [logsTab, setLogsTab] = useState('files'); // 'files' | 'services'
  const [logsFiles, setLogsFiles] = useState([]);
  const [logsServices, setLogsServices] = useState([]);
  const [logsListLoading, setLogsListLoading] = useState(false);
  const [logsSelectedItem, setLogsSelectedItem] = useState(null);
  const [logsContent, setLogsContent] = useState('');
  const [logsContentLoading, setLogsContentLoading] = useState(false);
  const [logsAutoRefresh, setLogsAutoRefresh] = useState(false);
  const logsAutoRefreshRef = useRef(null);
  const logsOutputRef = useRef(null);
  // Sysinfo state
  const [sysInfo, setSysInfo] = useState(null);
  const [sysInfoLoading, setSysInfoLoading] = useState(false);
  const [agentInfo, setAgentInfo] = useState(null);
  const [agentInfoLoading, setAgentInfoLoading] = useState(false);
  const [agentsPageInfo, setAgentsPageInfo] = useState({});
  const [agentsPageLoading, setAgentsPageLoading] = useState(false);
  const [agentsExpandedId, setAgentsExpandedId] = useState(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState(new Set());
  // Branding
  const [customLogo, setCustomLogo] = useState(() => localStorage.getItem('serverctl_logo') || '');
  const [customTabTitle, setCustomTabTitle] = useState(() => localStorage.getItem('serverctl_tab_title') || 'ServerCTL');

  const [icmpHistory, setIcmpHistory] = useState({});  // { serverId: [{status, latency_ms, ts}, ...] }
  const [icmpLoading, setIcmpLoading] = useState(false);
  const [icmpLastUpdate, setIcmpLastUpdate] = useState(null);
  const PING_HISTORY_MAX = 60;

  const sshOutputRef = useRef(null);
  const isAdmin = user?.role === 'admin';
  const authHeader = user?.token
    ? { 'X-Session-Token': user.token }
    : { 'X-Dashboard-Token': import.meta.env.VITE_DASHBOARD_TOKEN || '' };

  const handleLogin = (data) => {
    localStorage.setItem('serverctl_user', JSON.stringify(data));
    setUser(data);
  };

  const handleLogout = () => {
    localStorage.removeItem('serverctl_user');
    setUser(null);
  };

  const osDistribution = useMemo(() => {
    const palette = ['#00d4ff','#c084fc','#00ff88','#ffb800','#ff2d55','#99d1db','#ef9f76'];
    const groups = {};
    servers.forEach(s => { const os = s.platform || 'Unknown'; groups[os] = (groups[os] || 0) + 1; });
    return Object.entries(groups).map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));
  }, [servers]);

  const fetchUsers = async () => {
    try {
      const r = await fetch('/api/users', { headers: { ...authHeader } });
      if (r.ok) setUsersList((await r.json()).users || []);
    } catch {}
  };

  const createUser = async () => {
    if (!newUsername || !newPassword) return;
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
    });
    setNewUsername(''); setNewPassword('');
    fetchUsers();
  };

  const deleteUser = async (username) => {
    if (!window.confirm(`Delete user "${username}"?`)) return;
    await fetch(`/api/users/${username}`, { method: 'DELETE', headers: { ...authHeader } });
    fetchUsers();
  };

  const fetchServers = async () => {
    try {
      const response = await fetch('/api/servers', { headers: { ...authHeader } });
      const data = await response.json();
      const list = data.servers || [];
      setServers(list);
      setLoading(false);
      list.filter(s => s.online).forEach(async s => {
        try {
          const r = await fetch(`/api/metrics/${s.id}`, { headers: { ...authHeader } });
          const d = await r.json();
          if (d.metrics) setServerMetricsMap(prev => ({ ...prev, [s.id]: d.metrics }));
        } catch {}
      });
    } catch (err) {
      console.error("Error loading servers:", err);
      setLoading(false);
    }
  };

  const [updatingAgents, setUpdatingAgents] = useState(false);
  const updateAllAgents = async () => {
    setUpdatingAgents(true);
    const online = servers.filter(s => s.online);
    await Promise.all(online.map(async srv => {
      try {
        await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ server_id: srv.id, command: 'update_agent' }) });
      } catch {}
    }));
    addToast('success', 'Agents updated', `Sent update command to ${online.length} server${online.length !== 1 ? 's' : ''}`);
    setUpdatingAgents(false);
  };

  const [syncingStatus, setSyncingStatus] = useState(false);
  const syncAllStatus = async () => {
    setSyncingStatus(true);
    const online = servers.filter(s => s.online);
    await Promise.all(online.map(async srv => {
      try {
        // Must run apt-get update first to refresh cache, then check what's actually upgradable
        await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ server_id: srv.id, command: 'update' }) });
        const [rebootRes, pkgRes] = await Promise.all([
          fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ server_id: srv.id, command: 'check_reboot' }) }),
          fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ server_id: srv.id, command: 'upgradable_packages' }) }),
        ]);
        const [rebootData, pkgData] = await Promise.all([rebootRes.json(), pkgRes.json()]);
        const rebootRequired = !rebootData.output?.includes('Unknown command') && rebootData.returncode === 0;
        const packages = (pkgData.output || '').split('\n').filter(l => l && l.includes('/') && !l.startsWith('Listing')).map(l => l.split('/')[0]);
        await fetch(`/api/servers/${srv.id}/pending-updates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ count: packages.length, packages, reboot_required: rebootRequired }),
        });
      } catch {}
    }));
    await fetchServers();
    setSyncingStatus(false);
  };

  const fetchPingAll = async () => {
    try {
      setIcmpLoading(true);
      const r = await fetch('/api/ping-all', { headers: { ...authHeader } });
      if (r.ok) {
        const data = await r.json();
        const ts = data.ts;
        setIcmpHistory(prev => {
          const next = { ...prev };
          (data.pings || []).forEach(p => {
            const hist = next[p.id] ? [...next[p.id]] : [];
            hist.push({ status: p.status, latency_ms: p.latency_ms, ts, name: p.name, host: p.host });
            if (hist.length > PING_HISTORY_MAX) hist.shift();
            next[p.id] = hist;
          });
          return next;
        });
        setIcmpLastUpdate(new Date());
      }
    } catch (e) { console.error('Ping-all failed:', e); }
    finally { setIcmpLoading(false); }
  };

  useEffect(() => { fetchServers(); fetchHostStatus(); fetchPingAll(); }, []);
  useEffect(() => {
    const id = setInterval(fetchPingAll, 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { document.title = customTabTitle; }, [customTabTitle]);
  // Timer to update elapsed time on running tasks
  const [, setTaskTick] = useState(0);
  useEffect(() => {
    if (!globalTasks.some(t => t.status === 'running')) return;
    const id = setInterval(() => setTaskTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [globalTasks.some(t => t.status === 'running')]); // eslint-disable-line
  useEffect(() => {
    if (navSection !== 'updates') return;
    const id = setInterval(fetchServers, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [navSection]);

  useEffect(() => {
    if (selectedServer && activeTab === 'overview') {
      fetchMetrics(selectedServer.id);
      fetchSysInfo(selectedServer);
    }
  }, [selectedServer, activeTab]); // eslint-disable-line

  useEffect(() => {
    return () => {
      if (sshWs) sshWs.close();
    };
  }, [sshWs]);

  useEffect(() => {
    if (sshOutputRef.current) {
      sshOutputRef.current.scrollTop = sshOutputRef.current.scrollHeight;
    }
  }, [sshOutput]);

  const fetchHostStatus = async () => {
    try {
      const response = await fetch('/api/servers', {
        headers: { ...authHeader }
      });
      if (response.ok) {
        const data = await response.json();
        const agentServer = data.servers?.find(s => s.host === '127.0.0.1' || s.host === 'localhost' || s.host === 'host.docker.internal');
        if (agentServer) {
          setHostStatus({ online: agentServer.online });
        } else {
          setHostStatus({ online: true });
        }
      }
    } catch {
      setHostStatus({ online: false });
    }
  };

  const fetchMetrics = async (serverId) => {
    setMetricsLoading(true);
    try {
      const response = await fetch(`/api/metrics/${serverId}`, {
        headers: { ...authHeader }
      });
      const data = await response.json();
      setMetrics(data.metrics || {});
    } catch (err) {
      console.error("Error loading metrics:", err);
    }
    setMetricsLoading(false);
  };

  const handleAdd = async () => {
    if (!manualHost) return alert("IP address is required");
    setShowAddModal(false);
    const response = await fetch('/api/servers', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...authHeader 
      },
      body: JSON.stringify({ host: manualHost, name: manualName })
    });
    const data = await response.json();
    const addedId = data.server?.id;
    const addedHost = manualHost;
    setManualHost(""); setManualName("");
    if (data.agent_token && data.server?.id) {
      let installCmd = '';
      try {
        const ir = await fetch(`/api/agent/install-command?server_id=${encodeURIComponent(data.server.id)}`, { headers: authHeader });
        const id2 = await ir.json();
        installCmd = id2.command || '';
      } catch {}
      setShowToken({ host: addedHost, token: data.agent_token, installCmd });
    }
    fetchServers();
  };

  const openWizard = () => {
    setWizardStep(1);
    setWizardOS('linux');
    setWizardName('');
    setWizardHost('');
    setWizardGroup('');
    setWizardConnected(false);
    setWizardNewServer(null);
    setWizardServerId('');
    setWizardInstallCmd('');
    wizardServerIdRef.current = '';
    wizardPreServersRef.current = servers.map(s => s.id);
    setShowWizard(true);
  };

  const closeWizard = async () => {
    setShowWizard(false);
    if (wizardPollRef.current) { clearInterval(wizardPollRef.current); wizardPollRef.current = null; }
    // Delete the server if it was created but agent never connected
    const sid = wizardServerId || wizardServerIdRef.current;
    if (sid && !wizardConnected) {
      try {
        await fetch(`/api/servers/${encodeURIComponent(sid)}`, { method: 'DELETE', headers: authHeader });
        fetchServers();
      } catch {}
    }
  };

  const fetchWizardInstallCmd = async (server_id, os) => {
    setWizardInstallCmdLoading(true);
    setWizardInstallCmd('');
    try {
      const r = await fetch(`/api/agent/install-command?server_id=${encodeURIComponent(server_id)}`, { headers: authHeader });
      const d = await r.json();
      setWizardInstallCmd(os === 'windows' ? (d.windows_command || d.command || '') : (d.command || ''));
    } catch {
      setWizardInstallCmd('# Error fetching install command — check backend connection');
    }
    setWizardInstallCmdLoading(false);
  };

  const startWizardPolling = () => {
    if (wizardPollRef.current) clearInterval(wizardPollRef.current);
    wizardPollRef.current = setInterval(async () => {
      try {
        const sid = wizardServerIdRef.current;
        if (!sid) return;
        const r = await fetch(`/api/servers/${sid}/status`, { headers: authHeader });
        if (!r.ok) return;
        const server = await r.json();
        if (server.online) {
          setWizardNewServer(server);
          setWizardConnected(true);
          clearInterval(wizardPollRef.current);
          wizardPollRef.current = null;
          // Refresh full server list in background
          fetch('/api/servers', { headers: authHeader }).then(r=>r.json()).then(d=>{ if(d.servers) setServers(d.servers); }).catch(()=>{});
        }
      } catch(e) { console.error('[Wizard] poll error:', e); }
    }, 3000);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this server?")) return;
    await fetch(`/api/servers/${id}`, {
      method: 'DELETE',
      headers: { ...authHeader }
    });
    if (selectedServer?.id === id) setSelectedServer(null);
    fetchServers();
  };

  const handleBulkDelete = async () => {
    if (selectedServers.length === 0) return;
    if (!confirm(`Delete ${selectedServers.length} server(s)? This cannot be undone.`)) return;
    await Promise.all(selectedServers.map(id =>
      fetch(`/api/servers/${id}`, { method: 'DELETE', headers: { ...authHeader } })
    ));
    setSelectedServers([]);
    if (selectedServer && selectedServers.includes(selectedServer.id)) setSelectedServer(null);
    fetchServers();
  };

  const exportCSV = () => {
    const rows = [['id', 'name', 'host', 'group']];
    servers.forEach(s => rows.push([s.id, s.name, s.host, s.group || '']));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'servers.csv';
    a.click();
  };

  const handleCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    await fetch('/api/servers/csv', {
      method: 'POST',
      headers: { ...authHeader },
      body: formData
    });
    e.target.value = '';
    fetchServers();
  };

  const handleServerClick = (server) => {
    setSelectedServer(server);
    setNavSection('manage');
    setActiveTab('overview');
    setSysInfo(null);
    setSshOutput('');
    setSshConnected(false);
    if (sshWs) sshWs.close();
  };

  const connectSSH = () => {
    if (!selectedServer) return;
    const ws = new WebSocket(`${WS_HOST}/ws/ssh/${selectedServer.id}`);
    
    ws.onopen = () => {
      const msg = {
        token: user?.token || import.meta.env.VITE_DASHBOARD_TOKEN,
        username: sshUsername,
        ssh_port: 22,
        cols: 220,
        rows: 50,
        method: sshAuthMethod,
      };
      if (sshAuthMethod === 'password') msg.password = sshPassword;
      else if (sshAuthMethod === 'key_path') msg.key_path = sshPassword;
      else if (sshAuthMethod === 'key_upload') msg.key_data = sshKeyContent;
      ws.send(JSON.stringify(msg));
    };
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          if (msg.data.includes('Connected') || msg.data.includes('Connecting')) {
            setSshConnected(true);
          }
          setSshOutput(prev => prev + msg.data);
        } else if (msg.type === 'error') {
          setSshOutput(prev => prev + msg.data);
        }
      } catch {
        setSshOutput(prev => prev + event.data);
        setSshConnected(true);
      }
    };
    
    ws.onclose = () => {
      setSshConnected(false);
      setSshOutput(prev => prev + '\nConnection closed\n');
    };
    
    ws.onerror = () => {
      setSshConnected(false);
      setSshOutput(prev => prev + '\nConnection error\n');
    };
    
    setSshWs(ws);
  };

  const disconnectSSH = () => {
    if (sshWs) {
      sshWs.send(JSON.stringify({ type: 'close' }));
      sshWs.close();
      setSshWs(null);
    }
    setSshConnected(false);
  };

  const sendSSH = (e) => {
    e.preventDefault();
    if (sshWs && sshConnected) {
      sshWs.send(JSON.stringify({ type: 'input', data: sshInput + '\n' }));
      setSshInput('');
    }
  };

  // ── Shell & RDP section ──
  const connectShellSSH = () => {
    setShellConnected(false);
    setShellSessionKey(k => k + 1); // force XTerminal remount
  };

  const disconnectShellSSH = () => {
    setShellConnected(false);
    setShellSessionKey(0);
  };

  const connectRDP = () => {
    setRdpConnected(false);
    setRdpSessionKey(k => k + 1);
  };

  const disconnectRDP = () => {
    setRdpConnected(false);
    setRdpSessionKey(0);
  };

  // ── Logs section ──
  const selectLogsServer = async (server) => {
    setLogsServer(server);
    setLogsSelectedItem(null);
    setLogsContent('');
    setLogsListLoading(true);
    const isWindows = String(server?.platform || '').toLowerCase().includes('windows');
    const [filesData, servicesData] = await Promise.allSettled([
      runAgentAction(server.id, 'list_logs'),
      runAgentAction(server.id, 'list_services'),
    ]);
    if (filesData.status === 'fulfilled') {
      const raw = filesData.value?.output || '';
      try {
        setLogsFiles(raw.startsWith('[') ? JSON.parse(raw) : []);
      } catch { setLogsFiles([]); }
    }
    if (servicesData.status === 'fulfilled') {
      const lines = (servicesData.value?.output || '').trim().split('\n');
      const svcs = isWindows
        ? lines.map(l => l.trim()).filter(s => s.length > 0)
        : lines.map(l => l.trim().split(/\s+/)[0]).filter(s => s.endsWith('.service')).map(s => s.replace('.service', ''));
      setLogsServices(svcs);
    }
    setLogsListLoading(false);
  };

  const loadLogFile = async (server, path) => {
    setLogsSelectedItem(path);
    setLogsContentLoading(true);
    setLogsContent('');
    try {
      const data = await runAgentAction(server.id, 'view_log', path);
      setLogsContent(data.output || '(empty)');
    } catch (e) { setLogsContent('Error: ' + e.message); }
    setLogsContentLoading(false);
    setTimeout(() => { if (logsOutputRef.current) logsOutputRef.current.scrollTop = logsOutputRef.current.scrollHeight; }, 0);
  };

  const loadServiceStatus = async (server, svc) => {
    setLogsSelectedItem('svc:' + svc);
    setLogsContentLoading(true);
    setLogsContent('');
    try {
      const data = await runAgentAction(server.id, 'service_status', svc);
      setLogsContent(data.output || '(empty)');
    } catch (e) { setLogsContent('Error: ' + e.message); }
    setLogsContentLoading(false);
  };

  const refreshLogsContent = () => {
    if (!logsServer || !logsSelectedItem) return;
    if (logsSelectedItem.startsWith('svc:')) {
      loadServiceStatus(logsServer, logsSelectedItem.slice(4));
    } else {
      loadLogFile(logsServer, logsSelectedItem);
    }
  };

  useEffect(() => {
    if (logsAutoRefreshRef.current) { clearInterval(logsAutoRefreshRef.current); logsAutoRefreshRef.current = null; }
    if (logsAutoRefresh && logsSelectedItem) {
      logsAutoRefreshRef.current = setInterval(refreshLogsContent, 5000);
    }
    return () => { if (logsAutoRefreshRef.current) clearInterval(logsAutoRefreshRef.current); };
  }, [logsAutoRefresh, logsSelectedItem, logsServer]); // eslint-disable-line

  const fetchSysInfo = async (srv) => {
    const target = srv || selectedServer;
    if (!target) return;
    setSysInfoLoading(true);
    setSysInfo(null);
    try {
      const data = await runAgentAction(target.id, 'sysinfo_json');
      if (data.output && data.output.startsWith('{')) setSysInfo(JSON.parse(data.output));
    } catch {}
    setSysInfoLoading(false);
  };

  const runAction = async (command, target = null) => {
    if (!selectedServer) return;
    setActionLoading(true);
    setActionOutput('');
    setActionView(null);
    const taskCommands = { update_agent: 'Update Agent', uninstall_agent: 'Uninstall Agent' };
    const taskId = taskCommands[command] ? addTask(selectedServer.name, command, taskCommands[command]) : null;
    try {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({ server_id: selectedServer.id, command, target })
      });
      const text = await response.text();
      let output;
      try {
        const data = JSON.parse(text);
        output = data.output || data.detail || JSON.stringify(data, null, 2);
      } catch {
        output = response.ok ? text : `Error ${response.status}: ${text.substring(0, 500)}`;
      }
      setActionOutput(output);
      if (taskId) updateTask(taskId, { status: 'done', output: output.substring(0, 200) });
    } catch (err) {
      setActionOutput('Error: ' + err.message);
      if (taskId) updateTask(taskId, { status: 'error', output: err.message });
    }
    setActionLoading(false);
  };

  const startScan = () => {
    const ws = new WebSocket(`${WS_HOST}/ws/scan`);
    setScanStatus('Connecting...');
    setFoundServers([]);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        token: user?.token || import.meta.env.VITE_DASHBOARD_TOKEN,
        subnets: [scanSubnet]
      }));
      setScanStatus('Scanning...');
    };
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'found') {
          setFoundServers(prev => [...prev, msg.host]);
        } else if (msg.type === 'progress') {
          setScanStatus(`Scanning ${msg.pct}% (${msg.scanned}/${msg.total})`);
        } else if (msg.type === 'done') {
          setScanStatus(`Scan complete! Found ${msg.total_found} servers`);
        }
      } catch {}
    };
    
    ws.onclose = () => {
      if (!scanStatus.includes('complete')) {
        setScanStatus('Disconnected');
      }
    };
    
    ws.onerror = () => {
      setScanStatus('Error');
    };
  };

  const addScannedServer = (server) => {
    setShowScan(false);
    setWizardStep(1);
    setWizardOS('linux');
    setWizardName(server.hostname || server.name || server.host);
    setWizardHost(server.host);
    setWizardGroup('');
    setWizardConnected(false);
    setWizardNewServer(null);
    setWizardServerId('');
    setWizardInstallCmd('');
    wizardServerIdRef.current = '';
    wizardPreServersRef.current = servers.map(s => s.id);
    setShowWizard(true);
  };

  const addAllScanned = async () => {
    for (const server of foundServers) {
      await addScannedServer(server);
    }
    setFoundServers([]);
    setScanStatus('');
    setShowScan(false);
  };

  const agentAction = async (command, target = null) => {
    const response = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ server_id: selectedServer.id, command, target }),
    });
    const text = await response.text();
    try { return JSON.parse(text); } catch { return { output: text, returncode: response.ok ? 0 : 1 }; }
  };

  const runAgentAction = async (serverId, command, target = null) => {
    const response = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ server_id: serverId, command, target }),
    });
    const text = await response.text();
    try { return JSON.parse(text); } catch { return { output: text, returncode: response.ok ? 0 : 1 }; }
  };

  const showMetricGraphic = async (view) => {
    setActionOutput('');
    setActionView(null);
    await fetchMetrics(selectedServer.id);
    setActionView(view);
  };

  const showSysInfo = async () => {
    setActionOutput('');
    setActionView(null);
    setActionLoading(true);
    try {
      const [uname, cpuRes] = await Promise.all([
        agentAction('system_info'),
        agentAction('cpu_info'),
      ]);
      const parts = (uname.output || '').trim().split(/\s+/);
      const hostname = parts[1] || selectedServer.name;
      const kernel = parts[2] || '';
      const arch = parts[parts.length - 1] || '';
      const lscpu = {};
      (cpuRes.output || '').split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx > -1) lscpu[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });
      setSysInfoData({ hostname, kernel, arch, lscpu });
      setActionView('sysinfo');
    } catch (e) {
      setActionOutput('Error: ' + e.message);
    }
    setActionLoading(false);
  };

  const showProcesses = async () => {
    setActionOutput('');
    setActionView(null);
    setActionLoading(true);
    try {
      const data = await agentAction('top_processes');
      const lines = (data.output || '').split('\n').slice(1);
      const procs = lines.map(line => {
        const cols = line.trim().split(/\s+/);
        if (cols.length < 11) return null;
        const [user, pid, cpu, mem, , , , , , time, ...cmdParts] = cols;
        const cmd = cmdParts.join(' ');
        if (cmd.startsWith('[') && cmd.endsWith(']')) return null;
        return { user, pid, cpu: parseFloat(cpu) || 0, mem: parseFloat(mem) || 0, cmd: cmd.split('/').pop().split(' ')[0], time };
      }).filter(Boolean).slice(0, 20);
      setProcessesData(procs);
      setActionView('processes');
    } catch (e) {
      setActionOutput('Error: ' + e.message);
    }
    setActionLoading(false);
  };

  // Parse upgradable_packages response - handles both JSON and apt-style text
  const parseUpgradablePackages = (output) => {
    const raw = (output || '').trim();
    if (!raw || raw === '0') return [];
    // Try JSON first (new format from v1.2.5+)
    if (raw.startsWith('{')) {
      try {
        const data = JSON.parse(raw);
        return (data.packages || []).map(p => typeof p === 'string' ? { name: p, version: '' } : p);
      } catch {}
    }
    // Fallback: apt-style text (package/repo version [upgradable from: x])
    return raw.split('\n')
      .filter(l => l && !l.startsWith('Listing') && l.includes('/'))
      .map(l => {
        const parts = l.split(' ');
        const name = parts[0]?.split('/')[0] || '';
        const version = parts[1] || '';
        return { name, version };
      });
  };

  const showUpdates = async () => {
    setActionOutput('');
    setActionView(null);
    setUpdatesData(null);
    setActionLoading(true);
    const taskId = addTask(selectedServer.name, 'check_updates', 'Check Updates');
    try {
      const updateRes = await agentAction('update');
      updateTask(taskId, { output: 'Checking packages...' });
      const lines = (updateRes.output || '').split('\n').filter(Boolean);
      const fetched = lines.filter(l => l.startsWith('Get:') || l.startsWith('Hit:') || l.startsWith('Ign:'));
      const summary = lines.find(l => l.includes('Fetched') || l.includes('up to date') || l.includes('Reading package') || l.includes('update(s) available') || l.includes('No updates'));
      let packages = [];
      try {
        const pkgRes = await agentAction('upgradable_packages');
        packages = parseUpgradablePackages(pkgRes.output);
      } catch {}
      setUpdatesData({ fetched: fetched.length, summary: summary || (packages.length > 0 ? `${packages.length} update(s) available` : 'No updates available'), packages, success: updateRes.returncode === 0 });
      setActionView('updates');
      updateTask(taskId, { status: 'done', output: `${packages.length} update${packages.length !== 1 ? 's' : ''} available` });
      await fetch(`/api/servers/${selectedServer.id}/pending-updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ count: packages.length, packages: packages.map(p => p.name) }),
      }).catch(() => {});
      fetchServers();
    } catch (e) {
      setActionOutput('Error: ' + e.message);
      updateTask(taskId, { status: 'error', output: e.message });
    }
    setActionLoading(false);
  };

  const refreshPendingUpdates = async () => {
    try {
      const res = await agentAction('upgradable_packages');
      const packages = parseUpgradablePackages(res.output);
      await fetch(`/api/servers/${selectedServer.id}/pending-updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ count: packages.length, packages: packages.map(p => p.name) }),
      });
      fetchServers();
    } catch (_) {}
  };

  const handleUpgrade = async () => {
    const isWindows = String(selectedServer?.platform || '').toLowerCase().includes('windows');
    const msg = isWindows
      ? 'Run Windows Update on this server? All pending updates will be downloaded and installed.'
      : 'Run apt-get upgrade on this server? All pending packages will be installed.';
    if (!window.confirm(msg)) return;
    setUpgradeLoading(true);
    setUpgradeOutput('');
    setActionView('upgradeResult');
    const taskId = addTask(selectedServer.name, 'upgrade', 'Upgrade Packages');
    try {
      const res = await agentAction('upgrade');
      setUpgradeOutput(res.output || res.error || 'Upgrade complete.');
      if (res.returncode === 0) {
        await refreshPendingUpdates();
        updateTask(taskId, { status: 'done', output: 'Upgrade complete' });
      } else {
        updateTask(taskId, { status: 'error', output: (res.output || '').substring(0, 200) });
      }
    } catch (e) {
      setUpgradeOutput('Error: ' + e.message);
      updateTask(taskId, { status: 'error', output: e.message });
    }
    setUpgradeLoading(false);
  };

  const fetchAgentInfo = async () => {
    if (!selectedServer) return;
    setAgentInfoLoading(true);
    setAgentInfo(null);
    try {
      const data = await agentAction('agent_info');
      const raw = data.output || '';
      if (raw.startsWith('{')) {
        const info = JSON.parse(raw);
        info.server_version = selectedServer.agent_version || '';
        setAgentInfo(info);
      } else {
        // Old agent without agent_info command — show version from server list
        setAgentInfo({
          version: selectedServer.agent_version || 'unknown',
          error_detail: raw.includes('nknown') ? 'Agent needs update to support this tab. Use "Update Agent" below.' : raw,
          server_version: selectedServer.agent_version || '',
        });
      }
    } catch (e) {
      setAgentInfo({ error: e.message });
    }
    setAgentInfoLoading(false);
  };

  const fetchAgentsPageInfo = async () => {
    setAgentsPageLoading(true);
    // Refresh server list first to get latest agent_version from backend
    let freshServers = servers;
    try {
      const srvRes = await fetch('/api/servers', { headers: authHeader });
      const srvData = await srvRes.json();
      if (srvData.servers) {
        setServers(srvData.servers);
        freshServers = srvData.servers;
      }
    } catch {}
    const onlineServers = freshServers.filter(s => s.online);
    const results = {};
    await Promise.all(onlineServers.map(async (s) => {
      try {
        const res = await fetch('/api/action', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ server_id: s.id, command: 'agent_info' }),
        });
        const data = await res.json();
        const raw = data.output || '';
        if (raw.startsWith('{')) {
          results[s.id] = JSON.parse(raw);
        } else {
          results[s.id] = { version: s.agent_version || 'unknown', error_detail: raw.includes('nknown') ? 'Agent needs update' : raw };
        }
      } catch (e) {
        results[s.id] = { version: s.agent_version || '?', error: e.message };
      }
    }));
    setAgentsPageInfo(results);
    setAgentsPageLoading(false);
  };

  const handleUpdateAgentById = async (server) => {
    if (!window.confirm(`Update agent on ${server.name} to the latest version?`)) return;
    const taskId = addTask(server.name, 'update_agent', 'Update Agent');
    try {
      const res = await fetch('/api/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ server_id: server.id, command: 'update_agent' }),
      });
      const data = await res.json();
      updateTask(taskId, { status: data.status === 'completed' ? 'done' : 'error', output: (data.output || '').substring(0, 200) });
    } catch (e) {
      updateTask(taskId, { status: 'error', output: e.message });
    }
  };

  const handleBulkUpdateAgents = async (serverIds) => {
    if (!window.confirm(`Update agents on ${serverIds.length} server(s)?`)) return;
    const taskId = addTask(`${serverIds.length} servers`, 'update_agent', 'Bulk Update Agents');
    await Promise.all(serverIds.map(async (id) => {
      try {
        await fetch('/api/action', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ server_id: id, command: 'update_agent' }),
        });
      } catch {}
    }));
    updateTask(taskId, { status: 'done', output: `Triggered on ${serverIds.length} servers` });
    setTimeout(fetchAgentsPageInfo, 20000);
  };

  const handleUpdateAgent = async () => {
    if (!window.confirm('Update agent on this server to the latest version?')) return;
    runAction('update_agent');
  };

  const handleUninstallAgent = async () => {
    if (!window.confirm('Uninstall the agent from this server? The server will go offline and be removed from the list.')) return;
    const serverName = selectedServer.name;
    const taskId = addTask(serverName, 'uninstall_agent', 'Uninstall Agent');
    try {
      await agentAction('uninstall_agent');
      if (selectedServer?.id) {
        await fetch(`/api/servers/${encodeURIComponent(selectedServer.id)}`, { method: 'DELETE', headers: authHeader });
        setSelectedServer(null);
        setNavSection('servers');
        fetchServers();
      }
      updateTask(taskId, { status: 'done', output: 'Agent removed' });
      addToast('success', 'Agent uninstalled', 'The agent has been removed from the server.');
    } catch (err) {
      updateTask(taskId, { status: 'error', output: err.message });
      addToast('error', 'Uninstall failed', err.message);
    }
  };

  const killProcess = async (pid) => {
    if (!window.confirm(`Kill process PID ${pid}?`)) return;
    try {
      const res = await agentAction('kill_process', pid);
      alert(res.status === 'completed' ? `PID ${pid} terminated` : (res.output || 'Failed'));
      showProcesses();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const fetchLogs = async () => {
    if (!selectedServer) return;
    setLogsLoading(true);
    setAvailableLogs([]);
    setSelectedLog(null);
    setLogsOutput('');
    try {
      const data = await agentAction('list_logs');
      const raw = data.output || '';
      if (raw.startsWith('[')) {
        setAvailableLogs(JSON.parse(raw));
      } else {
        setLogsOutput(raw.includes('Unknown command') ? 'Log listing not supported on this agent. Update the agent to enable this feature.' : raw);
      }
    } catch (err) {
      setLogsOutput('Error: ' + err.message);
    }
    setLogsLoading(false);
  };

  const fetchLogContent = async (logPath) => {
    setSelectedLog(logPath);
    setLogsLoading(true);
    setLogsOutput('');
    try {
      const data = await agentAction('view_log', logPath);
      setLogsOutput(data.output || '(empty)');
    } catch (err) {
      setLogsOutput('Error: ' + err.message);
    }
    setLogsLoading(false);
  };

  const fetchDocker = async () => {
    if (!selectedServer) return;
    setDockerLoading(true);
    setDockerContainers([]);
    try {
      const data = await agentAction('docker_ps');
      const lines = (data.output || '').trim().split('\n').filter(l => l.includes('|'));
      const containers = lines.map(line => {
        const [name, image, status, id] = line.split('|');
        return { name, image, status, id };
      });
      setDockerContainers(containers);
    } catch (err) {
      setDockerContainers([]);
    }
    setDockerLoading(false);
  };

  const fetchServices = async () => {
    if (!selectedServer) return;
    setServicesLoading(true);
    setServicesList([]);
    setSelectedService(null);
    setServiceDetail('');
    const isWindows = String(selectedServer?.platform || '').toLowerCase().includes('windows');
    try {
      const data = await agentAction('list_services');
      const lines = (data.output || '').trim().split('\n');
      const services = isWindows
        ? lines.map(l => l.trim()).filter(s => s.length > 0 && !s.startsWith('Name') && !s.startsWith('----')).map(l => l.split(/\s{2,}/)[0]).filter(Boolean)
        : lines.map(l => l.trim().split(/\s+/)[0]).filter(s => s.endsWith('.service')).map(s => s.replace('.service', ''));
      setServicesList([...new Set(services)]);
    } catch (err) {
      setServicesList([]);
    }
    setServicesLoading(false);
  };

  const fetchServiceDetail = async (service) => {
    setSelectedService(service);
    setServiceDetail('Loading...');
    try {
      const data = await agentAction('service_status', service);
      setServiceDetail(data.output || '(no output)');
    } catch (err) {
      setServiceDetail('Error: ' + err.message);
    }
  };

  const toggleServerSelection = (serverId) => {
    setSelectedServers(prev => 
      prev.includes(serverId) 
        ? prev.filter(id => id !== serverId)
        : [...prev, serverId]
    );
  };

  const refreshServerUpdates = async (serverId) => {
    try {
      await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ server_id: serverId, command: 'update' }) });
      const [pkgRes, rebootRes] = await Promise.all([
        fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ server_id: serverId, command: 'upgradable_packages' }) }),
        fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ server_id: serverId, command: 'check_reboot' }) }),
      ]);
      const [pkgData, rebootData] = await Promise.all([pkgRes.json(), rebootRes.json()]);
      const packages = (pkgData.output || '').split('\n').filter(l => l && l.includes('/') && !l.startsWith('Listing')).map(l => l.split('/')[0]);
      const rebootRequired = !rebootData.output?.includes('Unknown command') && rebootData.returncode === 0;
      await fetch(`/api/servers/${serverId}/pending-updates`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ count: packages.length, packages, reboot_required: rebootRequired }) });
      return packages.length;
    } catch { return null; }
  };

  const upgradeServers = async (serverIds) => {
    if (!serverIds.length) return;
    setBulkActionLoading(true);
    const initial = serverIds.map(id => {
      const s = servers.find(x => x.id === id);
      return { id, name: s?.name || id, host: s?.host || '', status: 'running', output: '' };
    });
    setBulkProgress(initial);
    setShowBulkModal(true);
    await Promise.all(initial.map(async (item) => {
      try {
        const res = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ server_id: item.id, command: 'upgrade' }) });
        let data;
        try { data = await res.json(); } catch { data = { status: 'error', detail: `Server returned HTTP ${res.status}` }; }
        setBulkProgress(prev => prev.map(p => p.id === item.id ? { ...p, status: data.status === 'completed' ? 'done' : 'error', output: data.output || data.detail || '' } : p));
        if (data.status === 'completed') {
          setUpgradedServerIds(prev => new Set([...prev, item.id]));
          const remaining = await refreshServerUpdates(item.id);
          if (remaining === 0) {
            addToast('success', `${item.name} updated`, 'No more pending updates');
          }
        } else {
          addToast('error', `Update failed: ${item.name}`, data.detail || data.output || `${item.host} — agent unreachable`);
        }
      } catch (err) {
        setBulkProgress(prev => prev.map(p => p.id === item.id ? { ...p, status: 'error', output: err.message } : p));
        addToast('error', `Update failed: ${item.name}`, `${item.host} — agent unreachable`);
      }
    }));
    setBulkActionLoading(false);
    fetchServers();
  };

  const promptReboot = (serverList) => {
    setRebootTargets(serverList);
    setRebootSelected(new Set(serverList.map(s => s.id)));
    setShowRebootConfirm(true);
  };

  const executeReboot = async () => {
    setRebooting(true);
    setShowRebootConfirm(false);
    const toReboot = rebootTargets.filter(s => rebootSelected.has(s.id));
    await Promise.all(toReboot.map(async (s) => {
      try {
        const res = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ server_id: s.id, command: 'reboot' }),
        });
        const data = await res.json();
        if (data.status === 'completed') {
          addToast('success', `Reboot: ${s.name}`, `${s.host} — reboot initiated`);
          // clear reboot flag
          await fetch(`/api/servers/${s.id}/pending-updates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify({ count: s.pending_updates?.count || 0, packages: s.pending_updates?.packages || [], reboot_required: false }),
          });
        } else {
          addToast('error', `Reboot failed: ${s.name}`, data.detail || data.output || 'Error');
        }
      } catch (err) {
        addToast('error', `Reboot failed: ${s.name}`, err.message);
      }
    }));
    setRebooting(false);
    fetchServers();
  };

  const addToast = (type, title, message) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000);
  };

  const addTask = (serverName, command, label) => {
    const id = Date.now() + Math.random();
    setGlobalTasks(prev => [...prev, { id, server: serverName, command, label: label || command, status: 'running', output: '', startTime: Date.now() }]);
    setShowTaskPanel(true);
    return id;
  };
  const updateTask = (taskId, updates) => {
    setGlobalTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  };
  const removeTask = (taskId) => {
    setGlobalTasks(prev => prev.filter(t => t.id !== taskId));
  };
  const clearFinishedTasks = () => {
    setGlobalTasks(prev => prev.filter(t => t.status === 'running'));
  };

  const runBulkAction = async (command) => {
    if (selectedServers.length === 0) return alert('Select at least one server');
    setBulkActionLoading(true);
    const bulkLabels = { update: 'Check Updates', upgrade: 'Upgrade', update_agent: 'Update Agent' };
    const bulkTaskId = addTask(`${selectedServers.length} servers`, command, `Bulk: ${bulkLabels[command] || command}`);
    const initial = selectedServers.map(id => {
      const s = servers.find(x => x.id === id);
      return { id, name: s?.name || id, host: s?.host || '', status: 'pending', output: '' };
    });
    setBulkProgress(initial);
    setBulkActionOutput('');
    setShowBulkModal(true);

    // Mark all as running immediately
    setBulkProgress(prev => prev.map(p => ({ ...p, status: 'running' })));

    await Promise.all(initial.map(async (item) => {
      try {
        const response = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ server_id: item.id, command }),
        });
        const data = await response.json();
        const isSSHError = !response.ok && (
          String(data.detail || '').toLowerCase().includes('unreachable') ||
          String(data.detail || '').toLowerCase().includes('connection') ||
          String(data.detail || '').toLowerCase().includes('timeout') ||
          String(data.detail || '').toLowerCase().includes('ssh')
        );
        if (isSSHError) {
          addToast('error', `SSH failed: ${item.name}`, `${item.host} — update must be done manually`);
        }
        setBulkProgress(prev => prev.map(p => p.id === item.id ? {
          ...p,
          status: data.status === 'completed' ? 'done' : 'error',
          output: isSSHError ? `SSH konekcija nije uspjela. Update mora biti urađen ručno.\n\n${data.detail || ''}` : (data.output || (data.detail ? String(data.detail) : '')),
        } : p));

        // After upgrade, immediately refresh pending-updates count + reboot flag
        if (command === 'upgrade' && data.status === 'completed') {
          try {
            const upgradeOut = data.output || '';
            let rebootRequired = false;
            const rebootRes = await fetch('/api/action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeader },
              body: JSON.stringify({ server_id: item.id, command: 'check_reboot' }),
            });
            const rebootData = await rebootRes.json();
            if (rebootData.output && rebootData.output.includes('Unknown command')) {
              rebootRequired = !!(upgradeOut.match(/restart required|reboot required|System restart/i));
            } else {
              rebootRequired = rebootData.returncode === 0;
            }

            await fetch('/api/action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeader },
              body: JSON.stringify({ server_id: item.id, command: 'update' }),
            });
            const pkgRes = await fetch('/api/action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeader },
              body: JSON.stringify({ server_id: item.id, command: 'upgradable_packages' }),
            });
            const pkgData = await pkgRes.json();
            const packages = (pkgData.output || '')
              .split('\n').filter(l => l && l.includes('/') && !l.startsWith('Listing')).map(l => l.split('/')[0]);

            await fetch(`/api/servers/${item.id}/pending-updates`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeader },
              body: JSON.stringify({ count: packages.length, packages, reboot_required: rebootRequired }),
            });
          } catch (_) {}
        }
      } catch (err) {
        addToast('error', `SSH failed: ${item.name}`, `${item.host} — update must be done manually`);
        setBulkProgress(prev => prev.map(p => p.id === item.id ? { ...p, status: 'error', output: `SSH connection failed. Update must be done manually.\n\n${err.message}` } : p));
      }
    }));
    setBulkActionLoading(false);
    updateTask(bulkTaskId, { status: 'done', output: `Completed on ${selectedServers.length} servers` });
    // Refresh server list so counts update in UI
    if (command === 'upgrade') fetchServers();
  };

  const runRepoTest = async (fromBackend = false) => {
    setRepoTestLoading(true); setRepoTestResult('');
    try {
      if (fromBackend) {
        const r = await fetch('/api/speedtest', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader } });
        const data = await r.json();
        setRepoTestResult(data.output || 'No result');
      } else {
        const srv = servers.find(s => s.id === repoTestServer && s.online);
        if (!srv) { setRepoTestLoading(false); return; }
        const r = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ server_id: srv.id, command: 'repo_speedtest' }) });
        const data = await r.json();
        // Agent doesn't support it yet — fall back to backend automatically
        if (data.output && data.output.startsWith('Unknown command')) {
          setRepoTestResult('⚠ Agent on this server is outdated (does not support repo_speedtest).\nFalling back to backend server test:\n\n');
          const r2 = await fetch('/api/speedtest', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader } });
          const d2 = await r2.json();
          setRepoTestResult(prev => prev + (d2.output || ''));
        } else {
          setRepoTestResult(data.output || data.detail || 'No result');
        }
      }
    } catch (e) { setRepoTestResult('Error: ' + e.message); }
    setRepoTestLoading(false);
  };

  const doPingAll = async (ids) => {
    const targets = servers.filter(s => ids.includes(s.id));
    const results = await Promise.all(targets.map(async srv => {
      try {
        const body = { type: probeType, host: srv.host };
        if (probeType === 'tcp') { body.port = parseInt(probePort) || 80; body.proto = 'tcp'; }
        if (probeType === 'udp') { body.port = parseInt(probePort) || 53; body.type = 'udp'; }
        if (probeType === 'http') { body.url = probeUrl || `http://${srv.host}`; }
        if (probeType === 'db')  { body.db_type = probeDb; }
        const r = await fetch('/api/probe', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(body) });
        const data = await r.json();
        return { id: srv.id, ...data };
      } catch (e) {
        return { id: srv.id, status: 'error', error: e.message, ts: new Date().toLocaleTimeString() };
      }
    }));
    setPingResults(prev => {
      const next = { ...prev };
      results.forEach(r => { next[r.id] = r; });
      return next;
    });
  };

  const startPingMonitor = async () => {
    setPingRunning(true);
    await doPingAll(pingSelected);
    setPingRunning(false);
  };

  const fetchNetworkInfo = async (cmd) => {
    if (!selectedServer) return;
    setNetworkInfoLoading(true);
    setNetworkInfoOutput('');
    try {
      const data = await agentAction(cmd);
      setNetworkInfoOutput(data.output || data.detail || 'No output');
    } catch (e) {
      setNetworkInfoOutput('Error: ' + e.message);
    }
    setNetworkInfoLoading(false);
  };

  const runNetworkTool = async () => {
    if (!networkTarget) return alert('Enter target IP or hostname');
    const abort = new AbortController();
    networkAbortRef.current = abort;
    setNetworkLoading(true);
    setNetworkOutput('');

    let command = networkTool;
    if (networkTool === 'ping') command = 'ping_count';
    else if (networkTool === 'traceroute') command = 'traceroute';
    else if (networkTool === 'nslookup') command = 'nslookup';

    try {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({ server_id: selectedServer?.id, command, target: networkTarget }),
        signal: abort.signal,
      });
      const data = await response.json();
      setNetworkOutput(JSON.stringify(data, null, 2));
    } catch (err) {
      if (err.name !== 'AbortError') setNetworkOutput('Error: ' + err.message);
    }
    setNetworkLoading(false);
    networkAbortRef.current = null;
  };

  const stopNetworkTool = () => {
    if (networkAbortRef.current) networkAbortRef.current.abort();
    setNetworkLoading(false);
    setNetworkOutput('Cancelled.');
  };

  const filteredServers = servers.filter(s => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = String(s.name || '').toLowerCase().includes(query) ||
                          String(s.host || '').toLowerCase().includes(query) ||
                          String(s.group || '').toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' ||
                          (statusFilter === 'online' && s.online) ||
                          (statusFilter === 'offline' && !s.online);
    const matchesGroup = groupFilter === 'all' || s.group === groupFilter;
    const matchesQuick = serverQuickFilter === 'all' ||
                         (serverQuickFilter === 'needs_update' && s.pending_updates?.count > 0) ||
                         (serverQuickFilter === 'needs_reboot' && s.pending_updates?.reboot_required);
    return matchesSearch && matchesStatus && matchesGroup && matchesQuick;
  }).sort((a, b) => {
    let av = sortBy === 'ip' ? String(a.host || '') : String(a.name || '');
    let bv = sortBy === 'ip' ? String(b.host || '') : String(b.name || '');
    if (sortBy === 'ip') {
      // numeric IP sort
      const toNum = ip => ip.split('.').map(n => parseInt(n,10) || 0).reduce((acc,v,i) => acc + v * Math.pow(256, 3-i), 0);
      const an = toNum(av), bn = toNum(bv);
      if (an !== bn) return sortOrder === 'asc' ? an - bn : bn - an;
    }
    const cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' });
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const onlineCount = servers.filter(s => s.online).length;
  const offlineCount = servers.length - onlineCount;

  const styles = {
    container: {
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      padding: 'var(--space-3)',
      fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif',
      color: 'var(--text-primary)',
      transition: 'background 0.3s, color 0.3s',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px',
    },
    title: {
      fontSize: '24px',
      fontWeight: '700',
      margin: 0,
    },
    headerActions: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
    },
    searchInput: {
      padding: '10px 16px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)',
      fontSize: '14px',
      background: 'var(--bg-card)',
      color: 'var(--text-primary)',
      width: '250px',
      outline: 'none',
    },
    btn: {
      padding: '6px 14px',
      border: 'none',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'var(--transition-base)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      letterSpacing: '-0.01em',
      borderRadius: 'var(--radius-md)',
      fontFamily: '"Plus Jakarta Sans", sans-serif',
    },
    btnPrimary: {
      background: '#4f9cf9',
      color: '#fff',
      border: 'none',
      boxShadow: '0 2px 8px rgba(79,156,249,0.3)',
    },
    btnSecondary: {
      background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-color)',
    },
    btnSuccess: {
      background: 'rgba(52,211,153,0.12)',
      color: '#34d399',
      border: '1px solid rgba(52,211,153,0.25)',
    },
    btnDanger: {
      background: 'rgba(248,113,113,0.1)',
      color: '#f87171',
      border: '1px solid rgba(248,113,113,0.22)',
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 'var(--space-2)',
      marginBottom: 'var(--space-3)',
    },
    statCard: () => ({
      background: 'var(--bg-card)',
      padding: '20px',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
    }),
    statLabel: {
      fontSize: '12px',
      color: 'var(--text-muted)',
      marginBottom: '8px',
      fontWeight: '500',
      letterSpacing: '0.01em',
    },
    statValue: {
      fontSize: '32px',
      fontWeight: '800',
      letterSpacing: '-0.03em',
      lineHeight: 1.1,
    },
    statSub: {
      fontSize: '12px',
      color: 'var(--text-muted)',
      marginTop: '5px',
      fontWeight: '400',
    },
    card: {
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
      marginBottom: 'var(--space-3)',
      border: '1px solid var(--border-color)',
      overflow: 'hidden',
    },
    cardHeader: {
      padding: '16px 20px',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: '13px',
      fontWeight: '700',
      margin: 0,
      letterSpacing: '-0.01em',
      color: 'var(--text-primary)',
    },
    cardBody: {
      padding: '0',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
    },
    th: {
      textAlign: 'left',
      padding: '10px 16px',
      fontSize: '10px',
      fontWeight: '600',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
      background: darkMode ? 'rgba(0,212,255,0.03)' : 'rgba(0,160,200,0.03)',
      borderBottom: '1px solid var(--border-color)',
    },
    td: {
      padding: '14px 16px',
      fontSize: '14px',
      borderBottom: '1px solid var(--border-color)',
      verticalAlign: 'middle',
    },
    serverName: {
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    statusBadge: (online) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: 'var(--radius-pill)',
      fontSize: '11px',
      fontWeight: '600',
      background: online ? 'rgba(0,217,126,0.1)' : 'rgba(255,107,107,0.1)',
      color: online ? 'var(--color-success)' : 'var(--color-danger)',
    }),
    statusDot: (online) => ({
      width: '7px',
      height: '7px',
      borderRadius: '50%',
      background: online ? 'var(--color-success)' : 'var(--color-danger)',
      boxShadow: online ? '0 0 10px rgba(0,217,126,0.5)' : 'none',
    }),
    groupBadge: {
      padding: '4px 8px',
      borderRadius: 'var(--radius-sm)',
      fontSize: '12px',
      background: 'var(--bg-card-hover)',
      color: 'var(--text-muted)',
    },
    actionBtns: {
      display: 'flex',
      gap: '6px',
    },
    iconBtn: {
      padding: '6px 10px',
      borderRadius: 'var(--radius-sm)',
      border: 'none',
      background: 'transparent',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'var(--transition-base)',
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'var(--overlay-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    modalContent: {
      background: 'var(--bg-card-solid)',
      borderRadius: 'var(--radius-2xl)',
      width: '90%',
      maxWidth: '960px',
      minWidth: '480px',
      minHeight: '300px',
      maxHeight: '92vh',
      overflow: 'auto',
      border: '1px solid var(--border-color)',
      resize: 'none',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: 'var(--shadow-2xl)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '20px 24px',
      borderBottom: '1px solid var(--border-color)',
    },
    modalBody: {
      padding: '24px',
    },
    tabs: {
      display: 'flex',
      gap: '0',
      marginBottom: 'var(--space-3)',
      borderBottom: '2px solid var(--border-color)',
    },
    tab: (active, hover) => ({
      padding: '10px 20px',
      border: 'none',
      borderBottom: active ? '2px solid #00d4ff' : '2px solid transparent',
      marginBottom: '-2px',
      background: hover && !active ? (darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)') : 'transparent',
      color: active ? '#00d4ff' : hover ? 'var(--text-primary)' : 'var(--text-muted)',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: active ? '600' : '400',
      letterSpacing: '0.02em',
      transition: 'var(--transition-base)',
      whiteSpace: 'nowrap',
      borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
    }),
    sshTerminal: {
      background: '#1a1a1a',
      color: '#f0f0f0',
      padding: '16px',
      borderRadius: 'var(--radius-md)',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '13px',
      minHeight: '300px',
      maxHeight: '400px',
      overflow: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    },
    sshInput: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid #333333',
      background: '#1a1a1a',
      color: '#f0f0f0',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '13px',
      marginTop: '12px',
    },
    closeBtn: {
      background: 'transparent',
      border: 'none',
      color: 'var(--text-muted)',
      fontSize: '24px',
      cursor: 'pointer',
      padding: '0',
      lineHeight: 1,
    },
    input: {
      padding: '8px 12px',
      border: '1px solid var(--input-border)',
      fontSize: '13px',
      outline: 'none',
      background: 'var(--input-bg)',
      color: 'var(--text-primary)',
      minWidth: '180px',
      borderRadius: 'var(--radius-md)',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    },
    label: {
      fontSize: '13px',
      fontWeight: '500',
      color: 'var(--text-muted)',
    },
    formRow: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      marginBottom: '16px',
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    actionOutput: {
      background: 'var(--bg-primary)',
      padding: '16px',
      borderRadius: 'var(--radius-md)',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      whiteSpace: 'pre-wrap',
      maxHeight: '200px',
      overflow: 'auto',
    },
    empty: {
      textAlign: 'center',
      padding: '40px',
      color: 'var(--text-muted)',
    },
  };

  const MetricBar = ({ label, value, color }) => (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: '600' }}>{value !== null ? value + '%' : 'N/A'}</span>
      </div>
      <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-card-hover)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value || 0}%`, background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  );

  // ── Parsers ──────────────────────────────────────────────────
  const parseDf = (text) => {
    const lines = text.trim().split('\n').filter(Boolean);
    // Linux: Filesystem Size Used Avail Use% Mounted on
    if (lines[0]?.includes('Filesystem')) {
      return lines.slice(1).map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 6) return null;
        const [fs, size, used, avail, usePct, ...mountParts] = parts;
        const pct = parseInt(usePct) || 0;
        return { fs, size, used, avail, pct, mount: mountParts.join(' ') };
      }).filter(Boolean);
    }
    // Windows: Name Used(GB) Free(GB) Total(GB) Used%
    if (lines[0]?.includes('Used(GB)') || lines[0]?.includes('Used%')) {
      return lines.filter(l => !l.startsWith('Name') && !l.startsWith('----')).map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) return null;
        const [name, usedGb, freeGb, totalGb, usedPct] = parts;
        const pct = parseFloat(usedPct) || 0;
        return { fs: name + ':', size: totalGb + 'GB', used: usedGb + 'GB', avail: freeGb + 'GB', pct: Math.round(pct), mount: name + ':\\' };
      }).filter(Boolean);
    }
    return null;
  };

  const parseFree = (text) => {
    const lines = text.trim().split('\n').filter(Boolean);
    if (!lines[0]?.includes('total') || !lines[0]?.includes('used')) return null;
    const parseRow = (line) => {
      const parts = line.trim().split(/\s+/);
      const label = parts[0].replace(':', '');
      const [, total, used, free, shared, buffCache, available] = parts;
      return { label, total, used, free, shared, buffCache, available };
    };
    return lines.slice(1).map(parseRow).filter(r => r.label);
  };

  const parseLscpu = (text) => {
    const lines = text.trim().split('\n').filter(Boolean);
    if (!lines.some(l => l.includes('Architecture') || l.includes('CPU(s)'))) return null;
    const entries = {};
    lines.forEach(line => {
      const idx = line.indexOf(':');
      if (idx > -1) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        if (key && val && key !== 'Flags') entries[key] = val;
      }
    });
    return entries;
  };

  const parseKeyVal = (text) => {
    const lines = text.trim().split('\n').filter(Boolean);
    const hasColons = lines.filter(l => l.includes(':')).length;
    if (hasColons < 3) return null;
    const entries = {};
    lines.forEach(line => {
      const idx = line.indexOf(':');
      if (idx > -1) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        if (key && val) entries[key] = val;
      }
    });
    return Object.keys(entries).length >= 3 ? entries : null;
  };

  // ── Output renderers ──────────────────────────────────────────
  const barTrack = { height: '6px', borderRadius: '3px', background: 'var(--bg-card-hover)', overflow: 'hidden' };
  const barFill = (pct, color) => ({ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.4s ease' });
  const pctColor = (pct) => pct >= 90 ? '#ff2d55' : pct >= 70 ? '#ffb800' : '#00d4ff';
  const badge = (text, color) => ({ display: 'inline-block', background: color + '20', color, padding: '1px 8px', borderRadius: '8px', fontWeight: '700', fontSize: '11px' });

  const parseMemVal = (str = '') => {
    if (!str || str === '0B') return 0;
    const m = str.match(/([\d.]+)([KMGT]?i?B?)/i);
    if (!m) return 0;
    const n = parseFloat(m[1]);
    const u = m[2].toUpperCase();
    if (u.startsWith('G')) return n;
    if (u.startsWith('M')) return n / 1024;
    if (u.startsWith('K')) return n / (1024 * 1024);
    return n;
  };

  const DfTable = ({ text }) => {
    const rows = parseDf(text);
    if (!rows) return <pre style={styles.actionOutput}>{text}</pre>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {rows.map((r, i) => {
          const color = pctColor(r.pct);
          return (
            <div key={i} style={{ background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-md)', padding: '12px 16px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{r.mount}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>{r.fs}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{r.used} / {r.size}</span>
                  <span style={badge(r.pct + '%', color)}>{r.pct}%</span>
                </div>
              </div>
              <div style={barTrack}><div style={barFill(r.pct, color)} /></div>
            </div>
          );
        })}
      </div>
    );
  };

  const FreeOutput = ({ text }) => {
    const rows = parseFree(text);
    if (!rows) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rows.map((r, i) => {
          const totalGb = parseMemVal(r.total);
          const usedGb = parseMemVal(r.used);
          const availGb = parseMemVal(r.available || r.free);
          const pct = totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0;
          const color = pctColor(pct);
          const isSwap = r.label === 'Swap';
          if (isSwap && totalGb === 0) return (
            <div key={i} style={{ background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-md)', padding: '12px 16px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Swap</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not configured</span>
            </div>
          );
          return (
            <div key={i} style={{ background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-md)', padding: '14px 16px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: '700' }}>{r.label === 'Mem' ? 'Memory (RAM)' : 'Swap'}</span>
                <span style={badge(pct + '%', color)}>{pct}%</span>
              </div>
              <div style={barTrack}><div style={barFill(pct, color)} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span>Used: <strong style={{ color: 'var(--text-primary)' }}>{r.used}</strong></span>
                  {r.buffCache && <span>Cache: <strong style={{ color: 'var(--text-primary)' }}>{r.buffCache}</strong></span>}
                  {r.available && <span>Free: <strong style={{ color: '#00ff88' }}>{r.available}</strong></span>}
                </div>
                <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{r.total}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const KVGrid = ({ data, title }) => {
    const priorityKeys = ['Model name', 'CPU(s)', 'Core(s) per socket', 'Thread(s) per core', 'Architecture', 'Vendor ID', 'CPU MHz', 'BogoMIPS', 'L1d cache', 'L1i cache', 'L2 cache', 'L3 cache', 'Hypervisor vendor', 'Virtualization type', 'Hostname', 'Kernel', 'OS', 'Uptime'];
    const sortedEntries = Object.entries(data).sort(([a], [b]) => {
      const ai = priorityKeys.indexOf(a), bi = priorityKeys.indexOf(b);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return (
      <div>
        {title && <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>{title}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sortedEntries.map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: i % 2 === 0 ? (darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0, marginRight: '16px' }}>{k}</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const ActionOutput = ({ text }) => {
    if (!text) return null;
    if (parseDf(text)) return <DfTable text={text} />;
    const freeRows = parseFree(text);
    if (freeRows) return <FreeOutput text={text} />;
    const lscpu = parseLscpu(text);
    if (lscpu) return <KVGrid data={lscpu} />;
    const kv = parseKeyVal(text);
    if (kv) return <KVGrid data={kv} />;
    return (
      <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--input-bg)', padding: '8px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff2d55' }} />
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffb800' }} />
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#00ff88' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px', fontFamily: '"JetBrains Mono", monospace' }}>output</span>
        </div>
        <pre style={{ margin: 0, padding: '14px 16px', background: darkMode ? '#1a1a1a' : '#f5f5f0', color: darkMode ? '#f0f0f0' : '#1e1e3a', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '320px', overflow: 'auto' }}>{text}</pre>
      </div>
    );
  };

  if (!user) return <LoginPage onLogin={handleLogin} darkMode={darkMode} toggleDark={() => setDarkMode(!darkMode)} />;

  const navItems = [
    { key: 'dashboard',  icon: '⬡',  label: 'Dashboard' },
    { key: 'servers',    icon: '▦',   label: 'Servers' },
    { key: 'networks',   icon: '⬡',   label: 'Networks' },
    { key: 'logs',       icon: '≡',   label: 'Logs' },
    { key: 'shell',      icon: '>_',  label: 'Shell & RDP' },
    { key: 'agents',     icon: '◈',   label: 'Agents' },
    { key: 'updates',    icon: '↑',   label: 'Updates' },
    { key: 'activity',   icon: '◷',   label: 'Activity' },
    { key: 'schedules',  icon: '⏰',  label: 'Schedules' },
    { key: 'settings',   icon: '⚙',   label: 'Settings' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: '"Plus Jakarta Sans", -apple-system, sans-serif', background: 'var(--bg-primary)', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        * { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif !important; }
        code, pre, .mono, .terminal-output { font-family: 'JetBrains Mono', monospace !important; }
        .probe-info-wrap:hover .probe-info-icon { background: var(--color-primary) !important; color: #fff !important; }
        .probe-info-wrap:hover .probe-tooltip { display: block !important; }
        input, select, textarea { color-scheme: ${darkMode ? 'dark' : 'light'}; }
        .nav-item:hover { background: ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'} !important; color: var(--text-primary) !important; }
      `}} />

      {/* Ambient background */}
      <div className={darkMode ? 'grid-bg-dark' : 'grid-bg-light'} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Sidebar ── */}
      <nav className="sidebar-nav" style={{ width: sidebarCollapsed ? '64px' : '224px', position: 'fixed', top: 0, bottom: 0, left: 0, background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', zIndex: 500, overflowY: 'auto', transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)', color: 'var(--text-primary)' }}>

        {/* Brand */}
        <div style={{ padding: sidebarCollapsed ? '16px 0' : '16px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', minHeight: '60px', boxSizing: 'border-box', position: 'relative', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
          {sidebarCollapsed ? (
            customLogo
              ? <img src={customLogo} alt="logo" style={{ maxHeight: '30px', maxWidth: '30px', objectFit: 'contain', borderRadius: '8px' }} />
              : <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #4f9cf9, #a78bfa)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(79,156,249,0.3)' }}>
                  <span style={{ fontSize: '14px', color: '#fff' }}>◈</span>
                </div>
          ) : (
            <>
              {customLogo
                ? <img src={customLogo} alt="logo" style={{ maxHeight: '28px', maxWidth: '120px', objectFit: 'contain', borderRadius: '6px' }} />
                : <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #4f9cf9, #a78bfa)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(79,156,249,0.3)' }}>
                    <span style={{ fontSize: '14px', color: '#fff' }}>◈</span>
                  </div>
              }
              {!customLogo && <span style={{ fontWeight: '800', fontSize: '15px', letterSpacing: '-0.03em', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{customTabTitle || 'ServerCTL'}</span>}
            </>
          )}
          {!sidebarCollapsed && (
            <button onClick={toggleSidebar} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', fontSize: '11px', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}>◂</button>
          )}
          {sidebarCollapsed && (
            <button onClick={toggleSidebar} style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)', background: 'var(--sidebar-bg)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '10px', zIndex: 10 }}>▸</button>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {navItems.map(item => {
            const active = navSection === item.key || (navSection === 'manage' && item.key === 'servers');
            const updatesBadge = item.key === 'updates' && servers.some(s => s.pending_updates?.count > 0)
              ? servers.reduce((sum, s) => sum + (s.pending_updates?.count || 0), 0) : 0;
            const iconColors = { dashboard: '#4f9cf9', servers: '#34d399', networks: '#a78bfa', logs: '#fbbf24', shell: '#f87171', agents: '#fb923c', updates: '#38bdf8', activity: '#a3e635', schedules: '#f472b6', settings: '#94a3b8' };
            const iconBg = iconColors[item.key] || '#4f9cf9';
            return (
              <button key={item.key} className={active ? '' : 'nav-item'}
                onClick={() => { setNavSection(item.key); if (item.key === 'servers') setServerQuickFilter('all'); if (item.key === 'settings' && isAdmin) fetchUsers(); if (item.key === 'agents') fetchAgentsPageInfo(); }}
                title={sidebarCollapsed ? item.label : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: sidebarCollapsed ? '9px 0' : '8px 10px', border: 'none', borderRadius: '10px', background: active ? (darkMode ? 'rgba(79,156,249,0.12)' : 'rgba(79,156,249,0.1)') : 'transparent', color: active ? '#4f9cf9' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '13.5px', fontWeight: active ? '600' : '400', width: '100%', textAlign: 'left', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginBottom: '2px', transition: 'all 0.15s ease' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: active ? `${iconBg}22` : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px', transition: 'all 0.15s ease', color: active ? iconBg : 'var(--text-muted)' }}>
                  {item.icon}
                </div>
                {!sidebarCollapsed && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>}
                {!sidebarCollapsed && updatesBadge > 0 && (
                  <span style={{ background: '#fbbf24', color: '#000', fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '99px', lineHeight: '16px' }}>{updatesBadge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* User footer */}
        <div style={{ padding: sidebarCollapsed ? '12px 8px' : '12px 12px', borderTop: '1px solid var(--border-color)' }}>
          {!sidebarCollapsed ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '8px', borderRadius: '10px', background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f9cf9, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '12px', flexShrink: 0 }}>
                  {(user?.username || 'A').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}>{isAdmin ? 'Administrator' : 'User'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setDarkMode(!darkMode)} style={{ ...styles.btn, ...styles.btnSecondary, flex: 1, justifyContent: 'center', fontSize: '12px', padding: '6px 8px' }}>{darkMode ? '☀' : '🌙'}</button>
                <button onClick={handleLogout} style={{ ...styles.btn, ...styles.btnDanger, flex: 1, justifyContent: 'center', fontSize: '12px', padding: '6px 8px' }}>Sign out</button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f9cf9, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '12px' }}>
                {(user?.username || 'A').slice(0, 2).toUpperCase()}
              </div>
              <button onClick={() => setDarkMode(!darkMode)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', padding: '4px' }}>{darkMode ? '☀' : '🌙'}</button>
              <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '14px', padding: '4px' }}>⏻</button>
            </div>
          )}
        </div>
      </nav>

      {/* ── Main content ── */}
      <div className="main-content" style={{ marginLeft: sidebarCollapsed ? '64px' : '224px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 1, transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {/* Top Header */}
        <div className="top-header-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 28px', height: '56px', borderBottom: '1px solid var(--border-color)', background: 'var(--header-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 0 var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '15px', fontWeight: '700', margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              {navSection === 'manage' && selectedServer ? selectedServer.name : (navItems.find(n => n.key === navSection)?.label || customTabTitle)}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '99px', padding: '3px 9px 3px 7px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', animation: 'pulse 2.5s ease-in-out infinite' }} />
              <span style={{ fontSize: '11px', fontWeight: '500', color: '#34d399' }}>Live</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{user?.username}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{isAdmin ? 'Administrator' : 'User'}</div>
            </div>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f9cf9, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '12px', flexShrink: 0 }}>
              {(user?.username || 'A').slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="main-content-pad" style={{ padding: '24px 32px', flex: 1, width: '100%', overflow: 'hidden' }}>


      {/* ── SERVERS section ── */}
      {navSection === 'servers' && <>

      {/* Quick filter banner */}
      {serverQuickFilter !== 'all' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '10px 16px', borderRadius: '8px', background: serverQuickFilter === 'needs_reboot' ? 'rgba(255,107,107,0.08)' : 'rgba(255,192,72,0.08)', border: `1px solid ${serverQuickFilter === 'needs_reboot' ? 'rgba(255,107,107,0.2)' : 'rgba(255,192,72,0.2)'}` }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: serverQuickFilter === 'needs_reboot' ? '#ff2d55' : '#ffb800' }}>
            {serverQuickFilter === 'needs_reboot' ? `⚠ ${filteredServers.length} server(a) zahtijeva reboot` : `↑ ${filteredServers.length} server(a) ima dostupne update-e`}
          </span>
          {serverQuickFilter === 'needs_reboot' && (
            <button onClick={() => promptReboot(filteredServers.map(s => ({ id: s.id, name: s.name, host: s.host, pending_updates: s.pending_updates })))}
              style={{ background: '#ff2d55', color: '#fff', border: 'none', borderRadius: '7px', padding: '5px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
              ↺ Rebootuj sve
            </button>
          )}
          <button onClick={() => setServerQuickFilter('all')} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '6px' }}>✕ Resetuj filter</button>
        </div>
      )}

      {/* Stats bar */}
      <div className="stats-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total Servers', value: servers.length, color: '#00d4ff', icon: '▦', sub: 'registered' },
          { label: 'Online', value: onlineCount, color: '#00ff88', icon: '●', sub: 'reachable' },
          { label: 'Offline', value: offlineCount, color: '#ff2d55', icon: '○', sub: 'unreachable' },
          { label: 'Backend', value: hostStatus === null ? '…' : hostStatus.online ? 'OK' : 'DOWN', color: hostStatus?.online !== false ? '#00ff88' : '#ff2d55', icon: '⬡', sub: 'host status' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '22px 24px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: `var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.03)`, transition: 'var(--transition-base)' }}>
            <div style={{ position: 'absolute', bottom: '-8px', right: '-4px', fontSize: '48px', opacity: 0.06, color: stat.color, lineHeight: 1 }}>{stat.icon}</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{stat.label}</div>
            <div style={{ fontSize: '34px', fontWeight: '700', color: stat.color, lineHeight: 1.1, marginTop: '10px', letterSpacing: '-0.03em' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {['all', 'online', 'offline'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} style={{ ...styles.btn, padding: '6px 14px', fontSize: '13px', background: statusFilter === f ? 'var(--color-primary)' : 'var(--bg-card)', color: statusFilter === f ? '#fff' : 'var(--text-muted)', border: `1px solid ${statusFilter === f ? 'var(--color-primary)' : 'var(--border-color)'}` }}>
              {f === 'all' ? `All (${servers.length})` : f === 'online' ? `Online (${onlineCount})` : `Offline (${offlineCount})`}
            </button>
          ))}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '13px', pointerEvents: 'none' }}>🔍</span>
            <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ ...styles.input, paddingLeft: '30px', width: '180px', padding: '6px 10px 6px 30px', fontSize: '13px' }} />
          </div>
          {(() => {
            const groups = ['all', ...new Set(servers.map(s => s.group).filter(Boolean))].sort((a,b) => a==='all'?-1:b==='all'?1:a.localeCompare(b));
            if (groups.length <= 2) return null;
            return (
              <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
                style={{ ...styles.input, padding: '6px 10px', fontSize: '13px', height: 'auto', minWidth: '120px' }}>
                {groups.map(g => <option key={g} value={g}>{g === 'all' ? 'All Groups' : g}</option>)}
              </select>
            );
          })()}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={openWizard} style={{ ...styles.btn, ...styles.btnPrimary, fontSize: '13px' }}>+ Add</button>
          <button onClick={() => setShowScan(true)} style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '13px' }}>Scan</button>
<button onClick={exportCSV} style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '13px' }}>Export</button>
          <button onClick={() => setShowBulkPanel(!showBulkPanel)} style={{ ...styles.btn, background: selectedServers.length > 0 ? '#ffb800' : 'var(--bg-card-hover)', color: selectedServers.length > 0 ? '#fff' : 'var(--text-muted)', border: `1px solid var(--border-color)`, fontSize: '13px' }}>
            Bulk {selectedServers.length > 0 && `(${selectedServers.length})`}
          </button>
          <button onClick={syncAllStatus} disabled={syncingStatus} title="Sync update &amp; reboot status for all online servers"
            style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '13px', position: 'relative' }}>
            <span style={{ display: 'inline-block', animation: syncingStatus ? 'spin 0.8s linear infinite' : 'none' }}>↺</span>
            {syncingStatus && <span style={{ marginLeft: '5px', fontSize: '11px' }}>Syncing...</span>}
          </button>
          <div style={{ display: 'flex', border: `1px solid var(--border-color)`, borderRadius: '8px', overflow: 'hidden' }}>
            <button onClick={() => setViewMode('grid')} title="Grid view" style={{ ...styles.btn, padding: '8px 12px', borderRadius: 0, background: viewMode === 'grid' ? 'var(--color-primary)' : 'var(--bg-card)', color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)', border: 'none', fontSize: '15px' }}>⊞</button>
            <button onClick={() => setViewMode('list')} title="List view" style={{ ...styles.btn, padding: '8px 12px', borderRadius: 0, background: viewMode === 'list' ? 'var(--color-primary)' : 'var(--bg-card)', color: viewMode === 'list' ? '#fff' : 'var(--text-muted)', border: 'none', fontSize: '15px' }}>≡</button>
          </div>
        </div>
      </div>

      {showBulkPanel && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: `1px solid var(--border-color)`, padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Bulk Actions — <span style={{ color: 'var(--color-primary)' }}>{selectedServers.length} selected</span>
            </div>
            {bulkProgress.length > 0 && !bulkActionLoading && (
              <button onClick={() => setBulkProgress([])} style={{ ...styles.btn, padding: '3px 10px', fontSize: '11px', background: 'var(--bg-card-hover)', border: `1px solid var(--border-color)` }}>Clear</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => runBulkAction('update')} style={{ ...styles.btn, ...styles.btnPrimary }} disabled={bulkActionLoading}>Check Updates</button>
            <button onClick={() => runBulkAction('upgrade')} style={{ ...styles.btn, background: '#00ff88', color: '#fff', border: 'none' }} disabled={bulkActionLoading}>Upgrade Packages</button>
            {isAdmin && <button onClick={handleBulkDelete} disabled={bulkActionLoading} style={{ ...styles.btn, background: '#ff2d5520', color: '#ff2d55', border: '1px solid #ff2d5540' }}>Delete ({selectedServers.length})</button>}
          </div>

          {bulkProgress.length > 0 && !bulkActionLoading && (
            <button onClick={() => setShowBulkModal(true)} style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '12px', marginTop: '8px' }}>
              View Results ({bulkProgress.filter(p=>p.status==='done').length}/{bulkProgress.length} done)
            </button>
          )}
        </div>
      )}

      {/* Server list — grid or table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>⬡</div>Loading servers...
        </div>
      ) : filteredServers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>▦</div>No servers found
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filteredServers.map(s => {
            const sm = serverMetricsMap[s.id];
            const isSelected = selectedServers.includes(s.id);
            const pu = s.pending_updates;
            return (
              <div key={String(s.id || '')}
                style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: `1px solid ${isSelected ? '#00d4ff' : 'var(--border-color)'}`, overflow: 'hidden', transition: 'var(--transition-base)', boxShadow: hoveredRow === s.id ? 'var(--shadow-lg)' : 'var(--shadow-sm)', transform: hoveredRow === s.id ? 'translateY(-2px)' : 'none', position: 'relative', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                onMouseEnter={() => setHoveredRow(s.id)} onMouseLeave={() => setHoveredRow(null)}
              >
                <div style={{ height: '2px', background: s.online ? 'linear-gradient(90deg,#00d4ff,#00d4ff,#00d4ff)' : 'linear-gradient(90deg,#2a3040,#3a4050)' }} />
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleServerSelection(s.id)} style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.online ? '#00ff88' : '#ff2d55', boxShadow: s.online ? '0 0 6px #00ff8880' : 'none' }} />
                        <span style={{ fontSize: '12px', fontWeight: '600', color: s.online ? '#00ff88' : '#ff2d55' }}>{s.online ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {pu?.count > 0 && <span title={`${pu.count} updates available`} style={{ background: '#ffb80020', color: '#ffb800', fontSize: '11px', padding: '1px 6px', borderRadius: '8px', fontWeight: '700' }}>↑{pu.count}</span>}
                      <span style={{ fontSize: '11px', background: 'var(--bg-card-hover)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '20px', fontWeight: '500' }}>{s.group || 'default'}</span>
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div onClick={() => handleServerClick(s)} style={{ fontSize: '16px', fontWeight: '700', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} title="Click to manage">{String(s.name || '')}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
                      {String(s.host || '')}
                      {s.agent_version && <span style={{ marginLeft: '8px', fontSize: '10px', color: s.agent_version === (import.meta.env.VITE_APP_VERSION || '') ? '#00ff88' : '#ffb800', fontWeight: '600' }}>v{s.agent_version}</span>}
                    </div>
                  </div>
                  {sm ? (
                    <div style={{ marginBottom: '12px' }}>
                      {[['CPU', sm.cpu_percent, '#00d4ff'],['RAM', sm.ram_percent, '#c084fc'],['Disk', sm.disk_percent, '#ffb800']].map(([lbl, val, col]) => (
                        <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '28px', fontWeight: '600' }}>{lbl}</span>
                          <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'var(--bg-card-hover)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${val || 0}%`, background: col, transition: 'width 0.4s' }} />
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '32px', textAlign: 'right' }}>{val}%</span>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ marginBottom: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>{s.online ? 'Loading metrics...' : 'No metrics available'}</div>}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleServerClick(s)} style={{ flex: 1, ...styles.btn, background: 'var(--color-primary-muted)', color: '#00d4ff', fontSize: '13px', justifyContent: 'center', padding: '8px 12px', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 'var(--radius-md)', fontWeight: '600' }}>Manage</button>
                    {isAdmin && <button onClick={() => handleDelete(s.id)} style={{ ...styles.btn, ...styles.btnSecondary, padding: '8px 12px', fontSize: '13px' }}>✕</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List / Table view — Docker-style */
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: `1px solid var(--border-color)`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: darkMode ? '#1a1a1a' : '#f0f0f0', borderBottom: `2px solid var(--border-color)` }}>
                <th style={{ ...styles.th, width: '32px' }}>
                  <input type="checkbox" checked={selectedServers.length === filteredServers.length && filteredServers.length > 0}
                    onChange={() => setSelectedServers(selectedServers.length === filteredServers.length ? [] : filteredServers.map(s => s.id))} />
                </th>
                <th style={{ ...styles.th, textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => { if (sortBy==='name') setSortOrder(o=>o==='asc'?'desc':'asc'); else { setSortBy('name'); setSortOrder('asc'); } }}>Name {sortBy==='name' ? (sortOrder==='asc' ? '▲' : '▼') : '⇅'}</th>
                <th style={{ ...styles.th, textAlign: 'left' }}>OS / Distro</th>
                <th style={{ ...styles.th, textAlign: 'left' }}>State</th>
                <th style={{ ...styles.th, textAlign: 'left' }}>CPU</th>
                <th style={{ ...styles.th, textAlign: 'left' }}>Memory</th>
                <th style={{ ...styles.th, textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => { if (sortBy==='ip') setSortOrder(o=>o==='asc'?'desc':'asc'); else { setSortBy('ip'); setSortOrder('asc'); } }}>IP {sortBy==='ip' ? (sortOrder==='asc' ? '▲' : '▼') : '⇅'}</th>
                <th style={{ ...styles.th, textAlign: 'left' }}>Agent</th>
                <th style={{ ...styles.th, textAlign: 'left' }}>Updates</th>
                <th style={{ ...styles.th, textAlign: 'left' }}>Reboot</th>
                <th style={{ ...styles.th, textAlign: 'left' }}>Group</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredServers.map(s => {
                const sm = serverMetricsMap[s.id];
                const pu = s.pending_updates;
                const platform = String(s.platform || '');
                const pl = platform.toLowerCase();
                const osIcon = pl.includes('ubuntu') ? '🟠'
                  : pl.includes('debian') ? '🔴'
                  : pl.includes('centos') ? '🟣'
                  : pl.includes('rhel') || pl.includes('red hat') ? '🔴'
                  : pl.includes('fedora') ? '🔵'
                  : pl.includes('arch') ? '🔵'
                  : pl.includes('alpine') ? '🔷'
                  : pl.includes('opensuse') || pl.includes('suse') ? '🟢'
                  : pl.includes('rocky') || pl.includes('almalinux') ? '🟢'
                  : pl.includes('windows') ? '🪟'
                  : '🐧';
                return (
                  <tr key={s.id}
                    style={{ borderBottom: `1px solid var(--border-color)30`, background: hoveredRow === s.id ? 'var(--bg-card-hover)' : 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={() => setHoveredRow(s.id)} onMouseLeave={() => setHoveredRow(null)}>
                    <td style={{ ...styles.td, width: '32px' }}>
                      <input type="checkbox" checked={selectedServers.includes(s.id)} onChange={() => toggleServerSelection(s.id)} />
                    </td>
                    {/* Name */}
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: s.online ? '#00ff88' : '#ff2d55', boxShadow: s.online ? '0 0 5px #00ff8880' : 'none' }} />
                        <div>
                          <div onClick={() => handleServerClick(s)} style={{ fontWeight: '600', fontSize: '13px', cursor: 'pointer' }} title="Click to manage">{String(s.name || '')}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>{String(s.host || '')}</div>
                        </div>
                      </div>
                    </td>
                    {/* OS / Distro */}
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>{osIcon}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{platform || 'Unknown'}</span>
                      </div>
                    </td>
                    {/* State */}
                    <td style={styles.td}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                        background: s.online ? '#00ff8818' : '#ff2d5518',
                        color: s.online ? '#00ff88' : '#ff2d55',
                        border: `1px solid ${s.online ? '#00ff8840' : '#ff2d5540'}`
                      }}>
                        {s.online ? 'running' : 'stopped'}
                      </span>
                    </td>
                    {/* CPU */}
                    <td style={{ ...styles.td, minWidth: '90px' }}>
                      {sm ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--bg-card-hover)', overflow: 'hidden', minWidth: '48px' }}>
                              <div style={{ height: '100%', width: `${sm.cpu_percent || 0}%`, background: sm.cpu_percent > 80 ? '#ff2d55' : sm.cpu_percent > 50 ? '#ffb800' : '#00d4ff', transition: 'width 0.4s' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{sm.cpu_percent}%</span>
                          </div>
                        </div>
                      ) : <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    {/* Memory */}
                    <td style={{ ...styles.td, minWidth: '110px' }}>
                      {sm ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--bg-card-hover)', overflow: 'hidden', minWidth: '48px' }}>
                              <div style={{ height: '100%', width: `${sm.ram_percent || 0}%`, background: sm.ram_percent > 80 ? '#ff2d55' : sm.ram_percent > 60 ? '#ffb800' : '#c084fc', transition: 'width 0.4s' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{sm.ram_used_gb}G / {sm.ram_total_gb}G</span>
                          </div>
                        </div>
                      ) : <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    {/* IP */}
                    <td style={{ ...styles.td, fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{s.host}</td>
                    {/* Agent Version */}
                    <td style={styles.td}>
                      {s.agent_version ? (
                        <span style={{ fontSize: '11px', fontFamily: '"JetBrains Mono",monospace', color: s.agent_version === (import.meta.env.VITE_APP_VERSION || '') ? '#00ff88' : '#ffb800', fontWeight: '600' }}>v{s.agent_version}</span>
                      ) : <span style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.4 }}>—</span>}
                    </td>
                    {/* Updates */}
                    <td style={styles.td}>
                      {pu?.count > 0
                        ? <span style={{ background: '#ffb80018', color: '#ffb800', fontSize: '11px', padding: '2px 8px', borderRadius: '8px', fontWeight: '700', border: '1px solid #ffb80040', whiteSpace: 'nowrap' }}>↑ {pu.count} pkg</span>
                        : <span style={{ fontSize: '11px', color: '#00ff88', opacity: 0.7 }}>✓ up to date</span>}
                    </td>
                    {/* Reboot required */}
                    <td style={styles.td}>
                      {pu?.reboot_required ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ background: '#ff2d5518', color: '#ff2d55', fontSize: '11px', padding: '2px 8px', borderRadius: '8px', fontWeight: '700', border: '1px solid #ff2d5540', whiteSpace: 'nowrap' }}>⚠ Required</span>
                          <button onClick={() => promptReboot([{ id: s.id, name: s.name, host: s.host, pending_updates: s.pending_updates }])}
                            style={{ background: '#ff2d5520', color: '#ff2d55', border: '1px solid #ff2d5540', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            ↺ Reboot
                          </button>
                        </div>
                      ) : <span style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.4 }}>—</span>}
                    </td>
                    {/* Stack / Group */}
                    <td style={styles.td}>
                      <span style={{ ...styles.groupBadge, fontSize: '11px' }}>{s.group || '—'}</span>
                    </td>
                    {/* Actions */}
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button title="Manage" onClick={() => handleServerClick(s)}
                          style={{ ...styles.iconBtn, background: '#00d4ff18', color: '#00d4ff', border: '1px solid #00d4ff30' }}>
                          ⚙
                        </button>
                        <button title="SSH Terminal" onClick={() => { setShellServer(s); setShellConnected(false); setShellSessionKey(0); setNavSection('shell'); }}
                          style={{ ...styles.iconBtn, background: '#c084fc18', color: '#c084fc', border: '1px solid #c084fc30' }}>
                          ⌨
                        </button>
                        <button title="Check Updates" onClick={() => { handleServerClick(s); setActiveTab('actions'); }}
                          style={{ ...styles.iconBtn, background: '#ffb80018', color: '#ffb800', border: '1px solid #ffb80030' }}>
                          ↑
                        </button>
                        {isAdmin && (
                          <button title="Delete" onClick={() => handleDelete(s.id)}
                            style={{ ...styles.iconBtn, background: '#ff2d5518', color: '#ff2d55', border: '1px solid #ff2d5530' }}>
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      </>} {/* end servers section */}

      {/* ── DASHBOARD section ── */}
      {navSection === 'dashboard' && (() => {
        const totalHosts = servers.length;
        const onlineHosts = servers.filter(s => s.online).length;
        const needsUpdate = servers.filter(s => s.pending_updates?.count > 0).length;
        const upToDate = totalHosts - needsUpdate;
        const upToDatePct = totalHosts > 0 ? Math.round(upToDate / totalHosts * 100) : 0;
        const needsReboot = servers.filter(s => s.pending_updates?.reboot_required).length;
        const totalPkgs = servers.reduce((acc, s) => acc + (s.pending_updates?.count || 0), 0);
        const compliance = totalHosts > 0 ? upToDate : 0;
        // OS distribution
        const osCounts = {};
        servers.forEach(s => {
          const pl = (s.platform || 'Unknown').split(' ')[0];
          osCounts[pl] = (osCounts[pl] || 0) + 1;
        });
        const osColors = ['#00d4ff','#00ff88','#ffb800','#c084fc','#ff2d55','#99d1db','#ef9f76'];
        const osEntries = Object.entries(osCounts).sort((a,b) => b[1]-a[1]);
        // Donut SVG helper
        const DonutChart = ({ segments, size = 110, sw = 20 }) => {
          const r = (size - sw) / 2;
          const circ = 2 * Math.PI * r;
          let off = 0;
          return (
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={darkMode ? '#1e1e3a' : '#f0f0f0'} strokeWidth={sw} />
              {segments.map((seg, i) => {
                const len = (seg.pct / 100) * circ;
                const el = <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color} strokeWidth={sw}
                  strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-off} strokeLinecap="round" />;
                off += len;
                return el;
              })}
            </svg>
          );
        };
        const onlinePct = totalHosts > 0 ? Math.round(onlineHosts / totalHosts * 100) : 0;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: '800', marginBottom: '2px' }}>Infrastructure Overview</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Live status across all registered hosts</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>All Hosts</span>
                <button onClick={fetchServers} style={{ ...styles.btn, ...styles.btnSecondary, padding: '6px 14px', fontSize: '12px' }}>↺ Refresh</button>
              </div>
            </div>

            {/* Top stat strip */}
            <div className="stats-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px' }}>
              {[
                { label: 'Total Hosts',    value: totalHosts,    color: '#00d4ff', sub: 'registered', icon: '⬡' },
                { label: 'Online',         value: `${onlineHosts}/${totalHosts}`, color: '#00ff88', sub: `${onlinePct}% reachable`, icon: '◉' },
                { label: 'Up to Date',     value: upToDate,      color: '#00d4ff', sub: `${upToDatePct}% compliant`, icon: '✓' },
                { label: 'Need Updates',   value: needsUpdate,   color: needsUpdate > 0 ? '#ffb800' : '#00ff88', sub: `${100 - upToDatePct}% outdated`, icon: '↑', filter: 'needs_update' },
                { label: 'Needs Reboot',   value: needsReboot,   color: needsReboot > 0 ? '#ff2d55' : '#00ff88', sub: 'after upgrade', icon: '⚠', filter: 'needs_reboot' },
              ].map(s => (
                <div key={s.label}
                  onClick={() => { if (s.filter) { setServerQuickFilter(s.filter); setStatusFilter('all'); setGroupFilter('all'); setSearchQuery(''); setNavSection('servers'); } }}
                  style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px 18px', border: `1px solid var(--border-color)`, borderTop: `3px solid ${s.color}`, position: 'relative', overflow: 'hidden', cursor: s.filter ? 'pointer' : 'default', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { if (s.filter) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${s.color}30`; } }}
                  onMouseLeave={e => { if (s.filter) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; } }}
                >
                  <div style={{ position: 'absolute', top: '12px', right: '14px', fontSize: '20px', opacity: 0.08 }}>{s.icon}</div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{s.label}</div>
                  <div style={{ fontSize: '30px', fontWeight: '800', color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.sub}</div>
                  {s.filter && <div style={{ position: 'absolute', bottom: '10px', right: '12px', fontSize: '10px', color: s.color, opacity: 0.6 }}>View →</div>}
                </div>
              ))}
            </div>

            {/* Second row */}
            <div className="stats-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
              {[
                { label: 'Outdated Packages', value: totalPkgs,  color: '#ef9f76', icon: '📦' },
                { label: 'Security Updates',  value: 0,          color: '#ff2d55', icon: '🔒' },
                { label: 'Compliance',        value: `${compliance}/${totalHosts}`, color: compliance === totalHosts ? '#00ff88' : '#ffb800', icon: '✅' },
                { label: 'Avg Pkgs / Host',   value: totalHosts > 0 ? Math.round(totalPkgs / totalHosts) : 0, color: '#c084fc', icon: '∅' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '14px 16px', border: `1px solid var(--border-color)`, display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ fontSize: '24px', opacity: 0.7, flexShrink: 0 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: s.color, lineHeight: 1.1 }}>{s.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {/* OS Distribution */}
              <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: `1px solid var(--border-color)` }}>
                <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '14px', color: 'var(--text-primary)' }}>OS Distribution</div>
                {totalHosts === 0 ? <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No hosts registered</div> : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <DonutChart
                        segments={osEntries.map(([,n], i) => ({ pct: Math.round(n / totalHosts * 100), color: osColors[i % osColors.length] }))}
                        size={110} sw={20}
                      />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <div style={{ fontSize: '22px', fontWeight: '800', lineHeight: 1 }}>{totalHosts}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>hosts</div>
                      </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {osEntries.map(([os, cnt], i) => (
                        <div key={os} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: osColors[i % osColors.length], flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', flex: 1, fontWeight: '500' }}>{os}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>{cnt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Update Status */}
              <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: `1px solid var(--border-color)` }}>
                <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '14px', color: 'var(--text-primary)' }}>Update Status</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Up to date',    count: upToDate,             color: '#00ff88' },
                    { label: 'Need updates',  count: needsUpdate,          color: '#ffb800' },
                    { label: 'Needs reboot',  count: needsReboot,          color: '#ff2d55' },
                    { label: 'Offline',       count: totalHosts - onlineHosts, color: '#64748b' },
                  ].map(row => (
                    <div key={row.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{row.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: row.color }}>{row.count}</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: darkMode ? 'rgba(255,255,255,0.05)' : '#f0f0f0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${totalHosts > 0 ? (row.count / totalHosts * 100) : 0}%`, background: row.color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid var(--border-color)`, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Compliance rate</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: upToDatePct === 100 ? '#00ff88' : '#ffb800' }}>{upToDatePct}%</span>
                </div>
              </div>

              {/* Online Servers list */}
              <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: `1px solid var(--border-color)`, overflow: 'hidden' }}>
                <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '14px', color: 'var(--text-primary)' }}>Host Status</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '200px' }}>
                  {servers.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No hosts registered</div>}
                  {servers.slice(0, 12).map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: `1px solid var(--border-color)10` }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: s.online ? '#00ff88' : '#ff2d55', boxShadow: s.online ? '0 0 4px #00ff8880' : 'none' }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(s.name||'')}</span>
                      {s.pending_updates?.reboot_required && <span title="Reboot required" style={{ fontSize: '10px', color: '#ff2d55' }}>⚠</span>}
                      {s.pending_updates?.count > 0 && <span style={{ fontSize: '10px', background: '#ffb80020', color: '#ffb800', padding: '1px 5px', borderRadius: '8px', fontWeight: '700' }}>↑{s.pending_updates.count}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Servers needing updates */}
            {needsUpdate > 0 && (
              <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: `1px solid var(--border-color)` }}>
                <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '12px', color: 'var(--text-primary)' }}>Servers Needing Updates</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {servers.filter(s => s.pending_updates?.count > 0).map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', background: darkMode ? '#1a1a1a' : '#f0f0f0', border: `1px solid var(--border-color)` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.online ? '#00ff88' : '#ff2d55', boxShadow: s.online ? '0 0 4px #00ff8880' : 'none' }} />
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '13px' }}>{String(s.name||'')}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>{s.host}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {s.pending_updates.reboot_required && <span style={{ background: '#ff2d5518', color: '#ff2d55', fontSize: '10px', padding: '1px 7px', borderRadius: '8px', fontWeight: '700', border: '1px solid #ff2d5540' }}>⚠ Reboot</span>}
                        <span style={{ background: '#ffb80018', color: '#ffb800', fontSize: '11px', padding: '2px 8px', borderRadius: '8px', fontWeight: '700', border: '1px solid #ffb80040' }}>↑ {s.pending_updates.count} pkg</span>
                        <button onClick={() => { handleServerClick(s); }} style={{ ...styles.iconBtn, background: '#00d4ff18', color: '#00d4ff', border: '1px solid #00d4ff30', fontSize: '11px' }}>Manage</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ping Monitor */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: `1px solid var(--border-color)` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>Ping Monitor</div>
                  {icmpLoading && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00d4ff', animation: 'pulse 1s ease-in-out infinite' }} />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {icmpLastUpdate && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Updated {icmpLastUpdate.toLocaleTimeString()}</span>}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.6 }}>every 60s</span>
                  <button onClick={fetchPingAll} disabled={icmpLoading} style={{ ...styles.btn, ...styles.btnSecondary, padding: '4px 12px', fontSize: '11px', opacity: icmpLoading ? 0.5 : 1 }}>↺</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {servers.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No hosts registered</div>}
                {servers.map(s => {
                  const hist = icmpHistory[s.id] || [];
                  const latest = hist[hist.length - 1];
                  const isUp = latest?.status === 'up';
                  const upCount = hist.filter(h => h.status === 'up').length;
                  const uptimePct = hist.length > 0 ? Math.round(upCount / hist.length * 100) : null;
                  const avgLatency = hist.length > 0 ? Math.round(hist.filter(h => h.latency_ms != null).reduce((a, h) => a + h.latency_ms, 0) / Math.max(1, hist.filter(h => h.latency_ms != null).length)) : null;
                  const pctColor = uptimePct === 100 ? '#00ff88' : uptimePct >= 80 ? '#ffb800' : uptimePct !== null ? '#ff2d55' : 'var(--text-muted)';
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid var(--border-color)`, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}>
                      {/* Uptime % badge */}
                      <div style={{ minWidth: '48px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: pctColor, background: `${pctColor}12`, padding: '3px 6px', borderRadius: '6px', border: `1px solid ${pctColor}30` }}>
                        {uptimePct !== null ? `${uptimePct}%` : '—'}
                      </div>
                      {/* Server name */}
                      <div style={{ minWidth: '120px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: '600' }}>{String(s.name || '')}</div>
                      {/* Ping bar - Uptime Kuma style */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2px', height: '26px', minWidth: 0, justifyContent: 'flex-end' }}>
                        {(() => {
                          const totalSlots = PING_HISTORY_MAX;
                          const emptySlots = totalSlots - hist.length;
                          const bars = [];
                          for (let i = 0; i < emptySlots; i++) {
                            bars.push(<div key={`e${i}`} style={{ width: '4px', flexShrink: 0, height: '100%', borderRadius: '2px', background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' }} />);
                          }
                          hist.forEach((h, i) => {
                            const up = h.status === 'up';
                            const bg = up ? '#00ff88' : '#ff2d55';
                            bars.push(
                              <div key={`p${i}`} title={`${up ? h.latency_ms + 'ms' : 'Down'} — ${new Date(h.ts).toLocaleTimeString()}`}
                                style={{ width: '4px', flexShrink: 0, height: '100%', borderRadius: '2px', background: bg, opacity: up ? (0.55 + Math.min(0.45, (h.latency_ms < 50 ? 0.45 : h.latency_ms < 200 ? 0.25 : 0.1))) : 1 }} />
                            );
                          });
                          return bars;
                        })()}
                      </div>
                      {/* Latest latency */}
                      <div style={{ minWidth: '60px', textAlign: 'right', fontSize: '12px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', color: isUp ? '#00ff88' : '#ff2d55' }}>
                        {latest ? (isUp ? `${latest.latency_ms}ms` : 'Down') : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}


      {/* ── NETWORKS section ── */}
      {navSection === 'networks' && (
        <div style={{ width: '100%' }}>
          {/* Top row: Network Scan + Speed Test side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: `1px solid var(--border-color)`, padding: '20px' }}>
            <h3 style={{ ...styles.cardTitle, marginBottom: '16px' }}>Network Scan</h3>
            <div style={styles.formRow}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Subnet (CIDR)</label>
                <input type="text" value={scanSubnet} onChange={e => setScanSubnet(e.target.value)} placeholder="192.168.1.0/24" style={styles.input} />
              </div>
              <button onClick={() => { setShowScan(true); }} style={{ ...styles.btn, ...styles.btnPrimary, alignSelf: 'flex-end' }}>Start Scan</button>
            </div>
          </div>

          {/* Speed Test */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: `1px solid var(--border-color)`, padding: '20px' }}>
            {(() => {
              const selSrv = servers.find(s => s.id === repoTestServer);
              const isWin = selSrv ? String(selSrv.platform || '').toLowerCase().includes('windows') : false;
              return <>
                <h3 style={{ ...styles.cardTitle, marginBottom: '4px' }}>{isWin ? 'Windows CDN Speed Test' : 'Repository Speed Test'}</h3>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  {isWin
                    ? 'Tests download speed to Microsoft Update CDN, Winget CDN and Cloudflare from the selected server.'
                    : 'Tests download speed to Ubuntu archive / security / updates repos from a server or from the backend host.'}
                </div>
              </>;
            })()}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={repoTestServer} onChange={e => setRepoTestServer(e.target.value)} style={{ ...styles.input, minWidth: '220px' }}>
                <option value="">From backend server</option>
                {servers.filter(s => s.online).map(s => <option key={s.id} value={s.id}>{String(s.name||'')} ({s.host})</option>)}
              </select>
              <button onClick={() => runRepoTest(!repoTestServer)} disabled={repoTestLoading} style={{ ...styles.btn, ...styles.btnPrimary }}>
                {repoTestLoading ? 'Testing...' : '▶ Run Test'}
              </button>
              {repoTestLoading && <div style={{ width: '14px', height: '14px', border: `2px solid var(--color-primary)40`, borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
            </div>
            {repoTestResult && (
              <div style={{ marginTop: '12px', background: darkMode ? '#1a1a1a' : '#f0f0f0', borderRadius: '8px', padding: '10px 14px', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'auto', border: `1px solid var(--border-color)` }}>
                {repoTestResult}
              </div>
            )}
          </div>
          </div>{/* end top grid */}

          {/* Ping Monitor — full width */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: `1px solid var(--border-color)`, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ ...styles.cardTitle, margin: 0 }}>Probe Monitor</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Probe type */}
                <select value={probeType} onChange={e => { setProbeType(e.target.value); setPingResults({}); }}
                  style={{ ...styles.input, width: 'auto', fontSize: '12px', padding: '5px 8px' }}>
                  <option value="ping">Ping (ICMP)</option>
                  <option value="tcp">TCP Port</option>
                  <option value="udp">UDP Port</option>
                  <option value="http">HTTP</option>
                  <option value="db">DB Port</option>
                </select>
                {/* TCP/UDP port input */}
                {(probeType === 'tcp' || probeType === 'udp') && (
                  <input type="number" value={probePort} onChange={e => setProbePort(e.target.value)}
                    placeholder="Port" min="1" max="65535"
                    style={{ ...styles.input, width: '80px', fontSize: '12px', padding: '5px 8px' }} />
                )}
                {/* HTTP URL input */}
                {probeType === 'http' && (
                  <input type="text" value={probeUrl} onChange={e => setProbeUrl(e.target.value)}
                    placeholder="http://host/path (leave blank = host root)"
                    style={{ ...styles.input, width: '260px', fontSize: '12px', padding: '5px 8px' }} />
                )}
                {/* DB preset */}
                {probeType === 'db' && (
                  <select value={probeDb} onChange={e => setProbeDb(e.target.value)}
                    style={{ ...styles.input, width: 'auto', fontSize: '12px', padding: '5px 8px' }}>
                    <option value="mysql">MySQL (3306)</option>
                    <option value="postgres">PostgreSQL (5432)</option>
                    <option value="mssql">MSSQL (1433)</option>
                    <option value="redis">Redis (6379)</option>
                    <option value="mongo">MongoDB (27017)</option>
                  </select>
                )}
                <button onClick={() => { const allIds = servers.map(s => s.id); setPingSelected(prev => prev.length === allIds.length ? [] : allIds); }}
                  style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '12px', padding: '5px 10px' }}>
                  {pingSelected.length === servers.length ? 'Deselect All' : 'Select All'}
                </button>
                <button onClick={startPingMonitor} disabled={pingSelected.length === 0 || pingRunning}
                  style={{ ...styles.btn, ...styles.btnPrimary, fontSize: '12px', padding: '5px 12px' }}>
                  {pingRunning ? '⟳ Probing...' : '▶ Run'}
                </button>
              </div>
            </div>

            {servers.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No servers registered.</div>}

            {(() => {
              // ── Tooltip descriptions ──────────────────────────────────
              const probeTooltip = (r) => {
                if (!r) return null;
                // HTTP status codes
                const httpDesc = {
                  200: 'OK — Zahtjev uspješan.',
                  201: 'Created — Resurs uspješno kreiran.',
                  204: 'No Content — Zahtjev uspješan, nema tijela odgovora.',
                  301: 'Moved Permanently — Resurs trajno premješten na novu URL adresu.',
                  302: 'Found — Privremeni redirect na drugu URL adresu.',
                  304: 'Not Modified — Resurs nije promijenjen od zadnjeg zahtjeva (cache).',
                  400: 'Bad Request — Server nije razumio zahtjev (loša sintaksa ili parametri).',
                  401: 'Unauthorized — Autentifikacija je obavezna. Niste prijavljeni ili token nije validan.',
                  403: 'Forbidden — Pristup zabranjen. Server razumije zahtjev ali odbija da ga izvrši.',
                  404: 'Not Found — Traženi resurs ne postoji na serveru.',
                  405: 'Method Not Allowed — HTTP metoda nije podržana za ovaj endpoint.',
                  408: 'Request Timeout — Server nije dobio kompletan zahtjev na vrijeme.',
                  409: 'Conflict — Zahtjev je u konfliktu sa trenutnim stanjem resursa.',
                  429: 'Too Many Requests — Prekoračen limit zahtjeva (rate limiting).',
                  500: 'Internal Server Error — Neočekivana greška na serveru.',
                  502: 'Bad Gateway — Server je primio nevažeći odgovor od upstream servera (reverse proxy problem).',
                  503: 'Service Unavailable — Server privremeno nedostupan (preopterećen ili u maintenance).',
                  504: 'Gateway Timeout — Upstream server nije odgovorio na vrijeme (proxy timeout).',
                  505: 'HTTP Version Not Supported — Server ne podržava korištenu HTTP verziju.',
                };
                // TCP/UDP/Ping status
                const statusDesc = {
                  up:            'Ping uspješan — host odgovara na ICMP echo zahtjev.',
                  timeout:       'Timeout — host nije odgovorio u zadanom roku. Firewall može blokirati ICMP/TCP/UDP.',
                  refused:       'Connection Refused — port je zatvoren, servis ne radi ili firewall aktivno odbija vezu (TCP RST).',
                  'open|filtered': 'Open ili Filtered — UDP port nije vratio ICMP "port unreachable". Port je vjerovatno otvoren ali ne šalje odgovor, ili ga firewall filtrira.',
                  closed:        'Closed — Primljen ICMP "port unreachable". UDP port je zatvoren.',
                  open:          'Open — veza uspješno uspostavljena. Port je otvoren i servis prima konekcije.',
                  unreachable:   'Unreachable — host nije dostupan. Provjeri IP adresu, routing i firewall pravila.',
                  error:         r.error ? `Greška: ${r.error}` : 'Nepoznata greška tokom probe-a.',
                };
                if (r.http_status) {
                  const code = r.http_status;
                  return httpDesc[code] || `HTTP ${code} — ${code < 400 ? 'Uspješan odgovor.' : code < 500 ? 'Client greška.' : 'Server greška.'}`;
                }
                return statusDesc[r.status] || null;
              };

              // ── Result label ─────────────────────────────────────────
              const resultLabel = (r) => {
                if (!r) return '—';
                if (r.http_status) return `${r.http_status}${r.latency_ms != null ? ` · ${r.latency_ms}ms` : ''}`;
                if (r.latency_ms != null) return `${r.latency_ms} ms`;
                return r.status;
              };

              // ── Status color ─────────────────────────────────────────
              const resultColor = (r) => {
                if (!r) return '#a0a0a0';
                if (r.http_status) {
                  if (r.http_status < 300) return '#00ff88';
                  if (r.http_status < 400) return '#ffb800';
                  return '#ff2d55';
                }
                if (r.status === 'up' || r.status === 'open') return '#00ff88';
                if (r.status === 'open|filtered') return '#ffb800';
                return '#ff2d55';
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {servers.map(srv => {
                    const r = pingResults[srv.id];
                    const selected = pingSelected.includes(srv.id);
                    const color = resultColor(r);
                    const tip = probeTooltip(r);
                    return (
                      <div key={srv.id} onClick={() => setPingSelected(prev => prev.includes(srv.id) ? prev.filter(x => x !== srv.id) : [...prev, srv.id])}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                          background: selected ? (darkMode ? 'rgba(0,212,255,0.08)' : 'rgba(0,212,255,0.05)') : (darkMode ? '#1a1a1a' : '#f5f5f0'),
                          border: `1px solid ${selected ? 'var(--color-primary)' + '60' : 'var(--border-color)'}`, transition: 'all 0.15s' }}>
                        {/* Checkbox */}
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--border-color)'}`, background: selected ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {selected && <div style={{ width: '8px', height: '6px', borderLeft: '2px solid #fff', borderBottom: '2px solid #fff', transform: 'rotate(-45deg) translate(1px,-1px)' }} />}
                        </div>
                        {/* Status dot */}
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, boxShadow: (r?.status === 'up' || r?.status === 'open') ? `0 0 6px ${color}80` : 'none', flexShrink: 0 }} />
                        {/* Server info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(srv.name || srv.host)}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>{srv.host}{probeType === 'db' ? ` · ${probeDb}` : probeType === 'tcp' || probeType === 'udp' ? ` · ${probeType.toUpperCase()}:${probePort || '?'}` : ''}</div>
                        </div>
                        {/* Result + tooltip */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', fontFamily: '"JetBrains Mono", monospace', color }}>{resultLabel(r)}</div>
                            {r?.ts && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.ts}</div>}
                          </div>
                          {tip && (
                            <div className="probe-info-wrap" style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                              <div className="probe-info-icon" style={{ width: '16px', height: '16px', borderRadius: '50%', background: darkMode ? '#444444' : '#d0d0d0', color: 'var(--text-muted)', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', userSelect: 'none' }}>ⓘ</div>
                              <div className="probe-tooltip" style={{ display: 'none', position: 'absolute', right: 0, bottom: '22px', width: '260px', background: darkMode ? '#1e1e3a' : '#fff', border: `1px solid var(--border-color)`, borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.5', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 100 }}>
                                {tip}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── AGENTS section ── */}
      {navSection === 'agents' && (() => {
        const appVersion = import.meta.env.VITE_APP_VERSION || '1.3.0';
        const onlineAgents = servers.filter(s => s.online);
        const outdatedAgents = onlineAgents.filter(s => s.agent_version && s.agent_version !== appVersion);
        const upToDateAgents = onlineAgents.filter(s => s.agent_version === appVersion);
        return (
          <div>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Total Agents', value: servers.length, color: '#00d4ff', icon: '◈' },
                { label: 'Online', value: onlineAgents.length, color: '#00ff88', icon: '◉' },
                { label: 'Need Update', value: outdatedAgents.length, color: outdatedAgents.length > 0 ? '#ffb800' : '#00ff88', icon: '↑' },
                { label: 'Latest Version', value: `v${appVersion}`, color: '#4888e8', icon: '⬡' },
              ].map(card => (
                <div key={card.label} style={{ padding: '16px 18px', background: darkMode ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', border: `1px solid ${card.color}30`, borderRadius: '12px' }}>
                  <div style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: '6px' }}>{card.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{card.icon}</span>
                    <span style={{ fontSize: '22px', fontWeight: '800', color: card.color }}>{card.value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions bar */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={fetchAgentsPageInfo} disabled={agentsPageLoading} style={{ ...styles.btn, ...styles.btnSecondary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{agentsPageLoading ? '◑' : '↺'}</span> {agentsPageLoading ? 'Syncing...' : 'Sync Status'}
              </button>
              {isAdmin && selectedAgentIds.size > 0 && (
                <button onClick={() => handleBulkUpdateAgents([...selectedAgentIds])} disabled={updatingAgents} style={{ ...styles.btn, ...styles.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{updatingAgents ? '⟳' : '⬆'}</span> {updatingAgents ? 'Updating...' : `Update Selected (${selectedAgentIds.size})`}
                </button>
              )}
              {isAdmin && onlineAgents.length > 0 && (
                <button onClick={() => {
                  if (selectedAgentIds.size === onlineAgents.length) { setSelectedAgentIds(new Set()); }
                  else { setSelectedAgentIds(new Set(onlineAgents.map(s => s.id))); }
                }} style={{ ...styles.btn, ...styles.btnSecondary, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  {selectedAgentIds.size === onlineAgents.length ? '☐ Deselect All' : '☑ Select All'}
                </button>
              )}
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>Manage agent updates across your infrastructure</span>
            </div>

            {/* Agent list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {servers.map(s => {
                const info = agentsPageInfo[s.id];
                const isExpanded = agentsExpandedId === s.id;
                const version = info?.version || s.agent_version || '?';
                const isOutdated = version && version !== appVersion && version !== '?';
                const isOnline = s.online;
                return (
                  <div key={s.id} style={{ border: `1px solid var(--border-color)`, borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
                    {/* Agent row */}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', gap: '14px' }}>
                      {/* Checkbox */}
                      {isAdmin && isOnline && (
                        <input type="checkbox" checked={selectedAgentIds.has(s.id)} onChange={() => setSelectedAgentIds(prev => {
                          const next = new Set(prev);
                          next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                          return next;
                        })} style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0, accentColor: '#00ff88' }} />
                      )}
                      {/* Status dot */}
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: isOnline ? '#00ff88' : '#ff2d55', boxShadow: isOnline ? '0 0 6px #00ff8880' : 'none' }} />
                      {/* Name & IP */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div onClick={() => handleServerClick(s)} style={{ fontWeight: '700', fontSize: '14px', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(s.name || '')}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono",monospace' }}>{s.host}</div>
                      </div>
                      {/* Platform badge */}
                      <span style={{ fontSize: '11px', padding: '2px 10px', background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', color: 'var(--text-muted)', borderRadius: '20px', flexShrink: 0 }}>
                        {String(s.platform || 'unknown').toLowerCase().includes('windows') ? '🪟' : '🐧'} {(s.platform || 'unknown').split(' ')[0]}
                      </span>
                      {/* Version */}
                      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '90px' }}>
                        <div style={{ fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '2px' }}>Agent Version</div>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: isOutdated ? '#ffb800' : isOnline ? '#00ff88' : 'var(--text-muted)' }}>
                          {version !== '?' ? `v${version}` : '—'}
                        </span>
                      </div>
                      {/* Status badge */}
                      <div style={{ flexShrink: 0, minWidth: '100px', textAlign: 'center' }}>
                        <div style={{ fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '2px' }}>Status</div>
                        {!isOnline ? (
                          <span style={{ fontSize: '11px', color: '#ff2d55', fontWeight: '600' }}>Offline</span>
                        ) : isOutdated ? (
                          <span style={{ fontSize: '11px', color: '#ffb800', fontWeight: '700', background: '#ffb80018', padding: '1px 8px', borderRadius: '8px', border: '1px solid #ffb80040' }}>↑ Update available</span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#00ff88', fontWeight: '600' }}>✓ Up to date</span>
                        )}
                      </div>
                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        {isAdmin && isOnline && (
                          <button onClick={() => handleUpdateAgentById(s)} title="Update Agent"
                            style={{ ...styles.iconBtn, background: isOutdated ? '#ffb80018' : '#00d4ff18', color: isOutdated ? '#ffb800' : '#00d4ff', border: `1px solid ${isOutdated ? '#ffb80030' : '#00d4ff30'}`, fontSize: '12px', padding: '4px 10px' }}>
                            ⬆ Update
                          </button>
                        )}
                        <button onClick={() => setAgentsExpandedId(isExpanded ? null : s.id)} title="Agent Info"
                          style={{ ...styles.iconBtn, background: '#c084fc18', color: '#c084fc', border: '1px solid #c084fc30', fontSize: '12px', padding: '4px 10px' }}>
                          ℹ Info
                        </button>
                        <button onClick={() => handleServerClick(s)} title="Manage Server"
                          style={{ ...styles.iconBtn, background: '#00d4ff18', color: '#00d4ff', border: '1px solid #00d4ff30' }}>
                          ⚙
                        </button>
                      </div>
                    </div>
                    {/* Expanded info */}
                    {isExpanded && info && (
                      <div style={{ borderTop: `1px solid var(--border-color)30`, padding: '12px 18px', background: darkMode ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                          {[
                            { label: 'Version', value: info.version },
                            { label: 'Uptime', value: info.uptime },
                            { label: 'OS / Arch', value: `${info.os || ''} / ${info.arch || ''}` },
                            { label: 'Go Version', value: info.go_version },
                            { label: 'Binary Path', value: info.binary },
                            { label: 'Config Path', value: info.config },
                            { label: 'Server URL', value: info.server_url },
                            { label: 'Build Date', value: info.build_date },
                          ].filter(r => r.value).map(row => (
                            <div key={row.label} style={{ display: 'flex', gap: '8px', padding: '6px 10px', background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap' }}>{row.label}:</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontFamily: '"JetBrains Mono",monospace', wordBreak: 'break-all' }}>{row.value || '—'}</span>
                            </div>
                          ))}
                        </div>
                        {info.error_detail && (
                          <div style={{ marginTop: '8px', padding: '8px 12px', background: '#ffb80010', border: '1px solid #ffb80030', fontSize: '11px', color: '#ffb800' }}>
                            ⚠ {info.error_detail}
                          </div>
                        )}
                      </div>
                    )}
                    {isExpanded && !info && (
                      <div style={{ borderTop: `1px solid var(--border-color)30`, padding: '12px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                        {isOnline ? 'Click "Sync Status" to load agent details' : 'Agent is offline'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── UPDATES section ── */}
      {navSection === 'updates' && (() => {
        const updServers = servers.filter(s => s.pending_updates?.count > 0 || upgradedServerIds.has(s.id));
        const selUpdates = selectedServers.filter(id => updServers.some(s => s.id === id));
        const allUpdSelected = updServers.length > 0 && updServers.every(s => selectedServers.includes(s.id));
        return (
          <div>
            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {updServers.length} server{updServers.length !== 1 ? 's' : ''} with pending updates
                {selUpdates.length > 0 && <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}> — {selUpdates.length} selected</span>}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {updServers.length > 0 && (
                  <button onClick={() => setSelectedServers(allUpdSelected ? selectedServers.filter(id => !updServers.some(s => s.id === id)) : [...new Set([...selectedServers, ...updServers.map(s => s.id)])])}
                    style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '12px' }}>
                    {allUpdSelected ? 'Deselect All' : 'Select All'}
                  </button>
                )}
                <button onClick={async () => {
                  const targets = updServers.filter(s => s.online);
                  if (!targets.length) return;
                  setBulkProgress(targets.map(s => ({ id: s.id, name: s.name, host: s.host, status: 'pending', output: '' })));
                  setBulkActionLoading(true);
                  await Promise.all(targets.map(async srv => {
                    setBulkProgress(prev => prev.map(p => p.id === srv.id ? { ...p, status: 'running' } : p));
                    try {
                      const count = await refreshServerUpdates(srv.id);
                      setBulkProgress(prev => prev.map(p => p.id === srv.id ? { ...p, status: 'done', output: count === 0 ? 'No pending updates' : `${count} package${count !== 1 ? 's' : ''} pending` } : p));
                    } catch (e) {
                      setBulkProgress(prev => prev.map(p => p.id === srv.id ? { ...p, status: 'error', output: e.message } : p));
                    }
                  }));
                  await fetchServers();
                  setBulkActionLoading(false);
                }} disabled={bulkActionLoading} style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '12px' }}>
                  ↺ Sync Updates
                </button>
                {selUpdates.length > 0 && (
                  <button onClick={() => upgradeServers(selUpdates)} disabled={bulkActionLoading}
                    style={{ ...styles.btn, background: '#00ff88', color: '#fff', border: 'none', fontSize: '12px' }}>
                    {bulkActionLoading ? 'Upgrading...' : `↑ Upgrade ${selUpdates.length} Server${selUpdates.length > 1 ? 's' : ''}`}
                  </button>
                )}
                {(() => {
                  const rebootable = selUpdates.filter(id => upgradedServerIds.has(id) || servers.find(s => s.id === id)?.pending_updates?.reboot_required);
                  return rebootable.length > 0 && (
                    <button onClick={() => promptReboot(rebootable.map(id => { const s = servers.find(x => x.id === id); return { id, name: s?.name, host: s?.host, pending_updates: s?.pending_updates }; }))}
                      style={{ ...styles.btn, background: '#ff2d5520', color: '#ff2d55', border: '1px solid #ff2d5540', fontSize: '12px' }}>
                      ↺ Reboot {rebootable.length} Server{rebootable.length > 1 ? 's' : ''}
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Bulk progress */}
            {bulkProgress.length > 0 && (
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bulkProgress.map(p => (
                  <div key={p.id} style={{ background: darkMode ? '#1a1a1a' : '#f0f0f0', borderRadius: '8px', padding: '10px 14px', border: `1px solid var(--border-color)` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.status === 'done' ? '#00ff88' : p.status === 'error' ? '#ff2d55' : p.status === 'running' ? '#ffb800' : 'var(--border-color)', animation: p.status === 'running' ? 'pulse 1s infinite' : 'none' }} />
                        <span style={{ fontWeight: '600', fontSize: '13px' }}>{p.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>{p.host}</span>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: p.status === 'done' ? '#00ff88' : p.status === 'error' ? '#ff2d55' : p.status === 'running' ? '#ffb800' : 'var(--text-muted)' }}>{p.status}</span>
                    </div>
                    <div style={{ height: '5px', borderRadius: '3px', background: darkMode ? '#1e1e3a' : '#d0d0d0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: p.status === 'pending' ? '0%' : p.status === 'running' ? '60%' : '100%', borderRadius: '3px', background: p.status === 'done' ? 'linear-gradient(90deg,#00ff88,#00ff88)' : p.status === 'error' ? '#ff2d55' : 'linear-gradient(90deg,#ffb800,#ffb800)', transition: p.status !== 'running' ? 'width 0.5s' : 'none', animation: p.status === 'running' ? 'shimmer 1.5s linear infinite' : 'none', backgroundSize: '200% 100%' }} />
                    </div>
                    {p.output && p.status !== 'pending' && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'pre-wrap', maxHeight: '60px', overflowY: 'auto', background: darkMode ? '#020617' : '#f0f0f0', borderRadius: '4px', padding: '4px 8px' }}>
                        {p.output.length > 400 ? p.output.slice(0, 400) + '\n…' : p.output}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {updServers.length === 0
              ? <div style={styles.empty}>All servers are up to date</div>
              : updServers.map(s => {
                const isSelected = selectedServers.includes(s.id);
                return (
                  <div key={s.id} style={{ background: 'var(--bg-card)', borderRadius: '12px', border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`, marginBottom: '12px', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: `1px solid var(--border-color)`, background: darkMode ? '#1a1a1a' : '#f0f0f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleServerSelection(s.id)} style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.online ? '#00ff88' : '#ff2d55', boxShadow: s.online ? '0 0 5px #00ff8880' : 'none' }} />
                        <div>
                          <span style={{ fontWeight: '700', fontSize: '14px' }}>{String(s.name||'')}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace', marginLeft: '8px' }}>{s.host}</span>
                        </div>
                        {!s.online && <span style={{ background: '#ff2d5518', color: '#ff2d55', fontSize: '10px', padding: '1px 7px', borderRadius: '8px', fontWeight: '700', border: '1px solid #ff2d5540' }}>Offline</span>}
                        {s.pending_updates?.reboot_required && <span style={{ background: '#ff2d5518', color: '#ff2d55', fontSize: '10px', padding: '1px 7px', borderRadius: '8px', fontWeight: '700', border: '1px solid #ff2d5540' }}>⚠ Reboot required</span>}
                        {upgradedServerIds.has(s.id) && !s.pending_updates?.reboot_required && (s.pending_updates?.count || 0) === 0 && <span style={{ background: '#00ff8818', color: '#00ff88', fontSize: '10px', padding: '1px 7px', borderRadius: '8px', fontWeight: '700', border: '1px solid #00ff8840' }}>✓ Updated</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {(s.pending_updates?.count || 0) > 0 && (
                          <span style={{ background: '#ffb80018', color: '#ffb800', fontSize: '12px', padding: '3px 10px', borderRadius: '8px', fontWeight: '700', border: '1px solid #ffb80040' }}>↑ {s.pending_updates.count} pkg</span>
                        )}
                        {s.online && (s.pending_updates?.count || 0) > 0 && (
                          <button onClick={() => upgradeServers([s.id])} disabled={bulkActionLoading}
                            style={{ ...styles.btn, background: '#00ff88', color: '#fff', border: 'none', padding: '5px 14px', fontSize: '12px' }}>
                            Upgrade
                          </button>
                        )}
                        {(upgradedServerIds.has(s.id) || s.pending_updates?.reboot_required) && (
                          <button onClick={() => promptReboot([{ id: s.id, name: s.name, host: s.host, pending_updates: s.pending_updates }])}
                            disabled={!s.online}
                            style={{ ...styles.btn, background: '#ff2d5520', color: '#ff2d55', border: '1px solid #ff2d5540', padding: '5px 14px', fontSize: '12px', opacity: s.online ? 1 : 0.5, cursor: s.online ? 'pointer' : 'not-allowed' }}>
                            ↺ Reboot
                          </button>
                        )}
                        {upgradedServerIds.has(s.id) && (s.pending_updates?.count || 0) === 0 && (
                          <button onClick={() => { setUpgradedServerIds(prev => { const n = new Set(prev); n.delete(s.id); return n; }); }}
                            style={{ ...styles.btn, ...styles.btnSecondary, padding: '5px 12px', fontSize: '12px' }}>
                            ✕ Dismiss
                          </button>
                        )}
                        <button onClick={() => handleServerClick(s)} style={{ ...styles.btn, ...styles.btnSecondary, padding: '5px 12px', fontSize: '12px' }}>Manage</button>
                      </div>
                    </div>
                    <div style={{ padding: '10px 18px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {(s.pending_updates?.packages || []).map((pkg, i) => (
                        <span key={i} style={{ background: 'var(--bg-card-hover)', fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>{pkg}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        );
      })()}

      {/* ── LOGS section ── */}
      {navSection === 'logs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px', height: 'calc(100vh - 120px)' }}>
          {/* Server list */}
          <div style={{ background: darkMode ? 'rgba(22,22,42,0.80)' : 'rgba(255,255,255,0.80)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: `1px solid var(--border-color)`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid var(--border-color)`, fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Online Servers</div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {servers.filter(s => s.online).length === 0 && <div style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>No servers online</div>}
              {servers.filter(s => s.online).map(s => (
                <div key={s.id} onClick={() => selectLogsServer(s)}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid var(--border-color)20`, background: logsServer?.id === s.id ? (darkMode ? '#181835' : '#f5f5f0') : 'transparent', borderLeft: `3px solid ${logsServer?.id === s.id ? 'var(--color-primary)' : 'transparent'}`, transition: 'all 0.1s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 5px #00ff8880', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600' }}>{String(s.name || '')}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>{s.host}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Log viewer panel */}
          <div style={{ background: darkMode ? 'rgba(22,22,42,0.80)' : 'rgba(255,255,255,0.80)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: `1px solid var(--border-color)`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!logsServer ? (
              <div style={styles.empty}>
                <div style={{ fontSize: '36px', opacity: 0.3, marginBottom: '12px' }}>📋</div>
                <div style={{ fontWeight: '600' }}>Select a server to view logs</div>
              </div>
            ) : (
              <>
                {/* Top bar */}
                <div style={{ padding: '10px 14px', borderBottom: `1px solid var(--border-color)`, display: 'flex', alignItems: 'center', gap: '10px', background: darkMode ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.7)', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: '600', fontSize: '13px', marginRight: '4px' }}>{logsServer.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>{logsServer.host}</span>
                  <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>📄 Log Files</div>
                  {logsSelectedItem && (
                    <>
                      <button onClick={refreshLogsContent} title="Refresh" style={{ ...styles.btn, ...styles.btnSecondary, padding: '4px 10px', fontSize: '12px' }}>↺</button>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={logsAutoRefresh} onChange={e => setLogsAutoRefresh(e.target.checked)} />
                        Auto (5s)
                      </label>
                    </>
                  )}
                  {logsListLoading && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading...</span>}
                </div>

                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                  {/* Source list */}
                  <div style={{ width: '200px', borderRight: `1px solid var(--border-color)`, overflowY: 'auto', flexShrink: 0 }}>
                    {logsTab === 'files' && (
                      logsFiles.length === 0
                        ? <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>{logsListLoading ? 'Loading...' : 'No log files found'}</div>
                        : logsFiles.map((f, i) => (
                          <div key={i} onClick={() => loadLogFile(logsServer, f.path)}
                            style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: `1px solid var(--border-color)15`, background: logsSelectedItem === f.path ? (darkMode ? '#181835' : '#f5f5f0') : 'transparent', borderLeft: `3px solid ${logsSelectedItem === f.path ? 'var(--color-primary)' : 'transparent'}`, transition: 'all 0.1s' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{(f.size / 1024).toFixed(1)} KB</div>
                          </div>
                        ))
                    )}
                  </div>

                  {/* Log content */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: darkMode ? '#1a1a1a' : '#f5f5f0' }}>
                    {!logsSelectedItem && (
                      <div style={styles.empty}>
                        <div style={{ fontSize: '28px', opacity: 0.3, marginBottom: '8px' }}>📄</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Select a log file from the list</div>
                      </div>
                    )}
                    {logsSelectedItem && logsContentLoading && (
                      <div style={styles.empty}><div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</div></div>
                    )}
                    {logsSelectedItem && !logsContentLoading && (
                      <pre ref={logsOutputRef}
                        style={{ flex: 1, margin: 0, padding: '14px 16px', fontFamily: '"Cascadia Code", "Source Code Pro", Menlo, monospace', fontSize: '12px', color: darkMode ? '#f0f0f0' : '#1e1e3a', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>
                        {logsContent}
                      </pre>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SHELL & RDP section ── */}
      {navSection === 'shell' && (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px', margin: '-24px', height: 'calc(100vh - 68px)' }}>
          {/* Server list */}
          <div style={{ background: darkMode ? 'rgba(22,22,42,0.80)' : 'rgba(255,255,255,0.80)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: `1px solid var(--border-color)`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Mode toggle */}
            <div style={{ display: 'flex', borderBottom: `1px solid var(--border-color)` }}>
              {['ssh', 'rdp'].map(mode => (
                <button key={mode} onClick={() => { setShellMode(mode); setShellServer(null); setShellConnected(false); setShellSessionKey(0); setRdpConnected(false); setRdpSessionKey(0); }}
                  style={{ flex: 1, padding: '10px', border: 'none', background: shellMode === mode ? 'var(--color-primary-muted)' : 'transparent', color: shellMode === mode ? 'var(--color-primary)' : 'var(--text-muted)', fontWeight: shellMode === mode ? '700' : '500', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'var(--transition-base)', borderBottom: shellMode === mode ? '2px solid var(--color-primary)' : '2px solid transparent' }}>
                  {mode === 'ssh' ? '>_ SSH' : '🖥 RDP'}
                </button>
              ))}
            </div>
            <div style={{ padding: '8px 14px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid var(--border-color)` }}>
              {shellMode === 'ssh' ? 'Linux Servers' : 'Windows Servers'}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {shellMode === 'ssh' && servers.filter(s => !String(s.platform || '').toLowerCase().includes('windows')).length === 0 && <div style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>No Linux servers</div>}
              {shellMode === 'rdp' && servers.filter(s => String(s.platform || '').toLowerCase().includes('windows')).length === 0 && <div style={{ padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>No Windows servers</div>}
              {servers.filter(s => shellMode === 'ssh'
                ? !String(s.platform || '').toLowerCase().includes('windows')
                : String(s.platform || '').toLowerCase().includes('windows')
              ).map(s => (
                <div key={s.id} onClick={() => { setShellServer(s); setShellConnected(false); setShellSessionKey(0); setRdpConnected(false); setRdpSessionKey(0); }}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid var(--border-color)20`, background: shellServer?.id === s.id ? (darkMode ? 'rgba(0,212,255,0.08)' : 'rgba(0,212,255,0.06)') : 'transparent', borderLeft: `3px solid ${shellServer?.id === s.id ? 'var(--color-primary)' : 'transparent'}`, transition: 'all 0.1s', opacity: s.online ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.online ? '#a6d189' : '#e78284', boxShadow: s.online ? '0 0 5px rgba(166,209,137,0.5)' : 'none', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600' }}>{String(s.name || '')}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>{s.host}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Terminal / RDP panel */}
          <div style={{ background: darkMode ? 'rgba(22,22,42,0.80)' : 'rgba(255,255,255,0.80)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: `1px solid var(--border-color)`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!shellServer ? (
              <div style={styles.empty}>
                <div style={{ fontSize: '36px', opacity: 0.3, marginBottom: '12px' }}>{shellMode === 'ssh' ? '⌨' : '🖥'}</div>
                <div style={{ fontWeight: '600' }}>Select a server to connect</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{shellMode === 'ssh' ? 'SSH terminal session' : 'Remote Desktop via RDP'}</div>
              </div>
            ) : shellMode === 'ssh' ? (
              <>
                {/* SSH Credentials bar */}
                <div style={{ padding: '10px 14px', borderBottom: `1px solid var(--border-color)`, background: darkMode ? 'rgba(15,23,42,0.7)' : 'rgba(248,250,252,0.9)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: shellConnected ? '#a6d189' : '#e5c890', boxShadow: shellConnected ? '0 0 6px rgba(166,209,137,0.5)' : 'none', flexShrink: 0 }} />
                    <span style={{ fontWeight: '600', fontSize: '13px', marginRight: '4px' }}>{shellConnected ? `${shellUsername}@${shellServer.host}` : shellServer.host}</span>
                    <input value={shellUsername} onChange={e => setShellUsername(e.target.value)} placeholder="username"
                      style={{ ...styles.input, width: '120px', padding: '4px 8px', fontSize: '12px' }} />
                    <select value={shellAuthMethod} onChange={e => setShellAuthMethod(e.target.value)}
                      style={{ ...styles.input, padding: '4px 8px', fontSize: '12px' }}>
                      <option value="password">Password</option>
                      <option value="key_path">Key Path</option>
                      <option value="key_upload">Key File</option>
                    </select>
                    {shellAuthMethod !== 'key_upload' && (
                      <input type={shellAuthMethod === 'password' ? 'password' : 'text'} value={shellPassword}
                        onChange={e => setShellPassword(e.target.value)}
                        placeholder={shellAuthMethod === 'key_path' ? '~/.ssh/id_rsa' : 'password'}
                        onKeyDown={e => e.key === 'Enter' && !shellConnected && connectShellSSH()}
                        style={{ ...styles.input, width: '160px', padding: '4px 8px', fontSize: '12px' }} />
                    )}
                    {shellAuthMethod === 'key_upload' && (
                      <label style={{ ...styles.btn, ...styles.btnSecondary, padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>
                        {shellKeyContent ? '✓ Key loaded' : 'Browse key...'}
                        <input type="file" style={{ display: 'none' }} onChange={e => {
                          const file = e.target.files[0];
                          if (file) { const r = new FileReader(); r.onload = ev => setShellKeyContent(ev.target.result); r.readAsText(file); }
                        }} />
                      </label>
                    )}
                    {!shellConnected
                      ? <button onClick={connectShellSSH} style={{ ...styles.btn, ...styles.btnPrimary, padding: '4px 14px', fontSize: '12px' }}>Connect</button>
                      : <button onClick={disconnectShellSSH} style={{ ...styles.btn, background: 'rgba(231,130,132,0.12)', color: '#e78284', border: 'none', padding: '4px 12px', fontSize: '12px' }}>Disconnect</button>
                    }
                  </div>
                  {shellAuthMethod === 'key_upload' && (
                    <textarea value={shellKeyContent} onChange={e => setShellKeyContent(e.target.value)}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                      style={{ ...styles.input, width: '100%', boxSizing: 'border-box', minHeight: '60px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', marginTop: '8px' }} />
                  )}
                </div>
                {/* SSH Terminal */}
                <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  {shellSessionKey === 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: darkMode ? '#232634' : '#e6e9ef', color: 'var(--text-muted)', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '28px', opacity: 0.3 }}>⌨</div>
                      <div style={{ fontSize: '13px' }}>Press Connect to start session</div>
                    </div>
                  )}
                  {shellSessionKey > 0 && (
                    <XTerminal
                      key={`${shellServer.id}-${shellSessionKey}`}
                      server={shellServer}
                      username={shellUsername}
                      authMethod={shellAuthMethod}
                      password={shellPassword}
                      keyContent={shellKeyContent}
                      token={user?.token || import.meta.env.VITE_DASHBOARD_TOKEN || ''}
                      wsHost={WS_HOST}
                      onConnected={() => setShellConnected(true)}
                      onDisconnected={() => setShellConnected(false)}
                    />
                  )}
                </div>
              </>
            ) : (
              <>
                {/* RDP Credentials bar */}
                <div style={{ padding: '10px 14px', borderBottom: `1px solid var(--border-color)`, background: darkMode ? 'rgba(15,23,42,0.7)' : 'rgba(248,250,252,0.9)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: rdpConnected ? '#a6d189' : '#e5c890', boxShadow: rdpConnected ? '0 0 6px rgba(166,209,137,0.5)' : 'none', flexShrink: 0 }} />
                    <span style={{ fontWeight: '600', fontSize: '13px', marginRight: '4px' }}>{rdpConnected ? `${shellUsername}@${shellServer.host}` : shellServer.host}</span>
                    <input value={shellUsername} onChange={e => setShellUsername(e.target.value)} placeholder="domain\username"
                      style={{ ...styles.input, width: '160px', padding: '4px 8px', fontSize: '12px' }} />
                    <input type="password" value={shellPassword} onChange={e => setShellPassword(e.target.value)}
                      placeholder="password"
                      onKeyDown={e => e.key === 'Enter' && !rdpConnected && connectRDP()}
                      style={{ ...styles.input, width: '140px', padding: '4px 8px', fontSize: '12px' }} />
                    <input value={rdpPort} onChange={e => setRdpPort(e.target.value)} placeholder="3389"
                      style={{ ...styles.input, width: '60px', padding: '4px 8px', fontSize: '12px', textAlign: 'center' }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                      <input type="checkbox" checked={rdpNla} onChange={e => setRdpNla(e.target.checked)}
                        style={{ width: '13px', height: '13px', cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
                      NLA
                    </label>
                    {!rdpConnected
                      ? <button onClick={connectRDP} style={{ ...styles.btn, ...styles.btnPrimary, padding: '4px 14px', fontSize: '12px' }}>Connect</button>
                      : <>
                          <button onClick={() => setRdpClipboard(v => !v)}
                            style={{ ...styles.btn, background: rdpClipboard ? 'rgba(96,165,250,0.25)' : 'rgba(96,165,250,0.12)', color: '#60a5fa', border: 'none', padding: '4px 12px', fontSize: '12px' }}>📋 Clipboard</button>
                          <button onClick={async () => {
                            const el = document.querySelector('[data-rdp-container]');
                            if (!el) return;
                            if (!document.fullscreenElement) {
                              await el.requestFullscreen().catch(() => {});
                              setRdpWidth(screen.width);
                              setRdpHeight(screen.height);
                              setRdpConnected(false);
                              setRdpSessionKey(k => k + 1);
                            } else {
                              document.exitFullscreen();
                              setRdpWidth(1280);
                              setRdpHeight(720);
                              setRdpConnected(false);
                              setRdpSessionKey(k => k + 1);
                            }
                          }} style={{ ...styles.btn, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: 'none', padding: '4px 12px', fontSize: '12px' }}>⛶ Fullscreen</button>
                          <button onClick={disconnectRDP} style={{ ...styles.btn, background: 'rgba(231,130,132,0.12)', color: '#e78284', border: 'none', padding: '4px 12px', fontSize: '12px' }}>Disconnect</button>
                        </>
                    }
                  </div>
                </div>
                {/* RDP Display */}
                {rdpClipboard && rdpConnected && (
                  <div style={{ padding: '8px 14px', borderBottom: `1px solid var(--border-color)`, background: darkMode ? 'rgba(15,23,42,0.9)' : 'rgba(248,250,252,0.95)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <textarea value={rdpClipText} onChange={e => setRdpClipText(e.target.value)}
                      placeholder="Paste text here, then click Send to RDP..."
                      style={{ ...styles.input, flex: 1, fontSize: '12px', padding: '6px 8px', minHeight: '32px', maxHeight: '80px', resize: 'vertical', fontFamily: 'monospace' }} />
                    <button onClick={() => { if (rdpDisplayRef.current && rdpClipText) { rdpDisplayRef.current.clipboardPaste(rdpClipText); setRdpClipText(''); setRdpClipboard(false); } }}
                      style={{ ...styles.btn, ...styles.btnPrimary, padding: '6px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>Send to RDP</button>
                  </div>
                )}
                <div data-rdp-container style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
                  {rdpSessionKey === 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: darkMode ? '#232634' : '#e6e9ef', color: 'var(--text-muted)', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '28px', opacity: 0.3 }}>🖥</div>
                      <div style={{ fontSize: '13px' }}>Press Connect to start RDP session</div>
                    </div>
                  )}
                  {rdpSessionKey > 0 && (
                    <NoVNCDisplay
                      ref={rdpDisplayRef}
                      key={`rdp-${shellServer.id}-${rdpSessionKey}`}
                      server={shellServer}
                      username={shellUsername.includes('\\') ? shellUsername.split('\\').slice(1).join('\\') : shellUsername.includes('/') ? shellUsername.split('/').slice(1).join('/') : shellUsername}
                      password={shellPassword}
                      domain={shellUsername.includes('\\') ? shellUsername.split('\\')[0] : shellUsername.includes('/') ? shellUsername.split('/')[0] : ''}
                      rdpPort={parseInt(rdpPort) || 3389}
                      security={rdpNla ? 'nla' : 'any'}
                      token={user?.token || import.meta.env.VITE_DASHBOARD_TOKEN || ''}
                      wsHost={WS_HOST}
                      width={rdpWidth}
                      height={rdpHeight}
                      onConnected={() => setRdpConnected(true)}
                      onDisconnected={() => setRdpConnected(false)}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {navSection === 'activity' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: `1px solid var(--border-color)`, padding: '20px' }}>
          <h3 style={{ ...styles.cardTitle, marginBottom: '16px' }}>Connected Agents</h3>
          {servers.filter(s=>s.online).map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid var(--border-color)20` }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 5px #00ff8880' }} />
                <span style={{ fontWeight: '600' }}>{String(s.name||'')}</span>
              </div>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{s.host}</span>
            </div>
          ))}
          {servers.filter(s=>s.online).length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No agents currently connected.</div>}
        </div>
      )}
      {navSection === 'schedules' && <div style={styles.empty}><div style={{ fontSize: '40px', opacity: 0.3, marginBottom: '12px' }}>⏰</div><div style={{ fontWeight: '600' }}>Schedules — Coming Soon</div></div>}

      {/* ── SETTINGS section ── */}
      {navSection === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: `1px solid var(--border-color)`, padding: '20px' }}>
            <h3 style={{ ...styles.cardTitle, marginBottom: '18px' }}>Branding</h3>

            {/* Logo upload */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Logo</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>Shown in the top-left of the sidebar</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {customLogo && <img src={customLogo} alt="current logo" style={{ maxHeight: '48px', maxWidth: '120px', objectFit: 'contain', borderRadius: '6px', border: `1px solid var(--border-color)` }} />}
                <label style={{ ...styles.btn, ...styles.btnSecondary, cursor: 'pointer' }}>
                  {customLogo ? 'Change Logo' : 'Upload Logo'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => { const val = ev.target.result; setCustomLogo(val); localStorage.setItem('serverctl_logo', val); };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }} />
                </label>
                {customLogo && <button onClick={() => { setCustomLogo(''); localStorage.removeItem('serverctl_logo'); }} style={{ ...styles.btn, background: '#ff2d5520', color: '#ff2d55', border: 'none' }}>Remove</button>}
              </div>
            </div>

            {/* Tab / app name */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>App Name</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>Shown in the browser tab and sidebar</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={customTabTitle} onChange={e => setCustomTabTitle(e.target.value)} style={{ ...styles.input, flex: 1 }} placeholder="ServerCTL" />
                <button onClick={() => { localStorage.setItem('serverctl_tab_title', customTabTitle); document.title = customTabTitle; }} style={{ ...styles.btn, ...styles.btnPrimary }}>Save</button>
                <button onClick={() => { setCustomTabTitle('ServerCTL'); localStorage.removeItem('serverctl_tab_title'); document.title = 'ServerCTL'; }} style={{ ...styles.btn, ...styles.btnSecondary }}>Reset</button>
              </div>
            </div>

            {/* Dark mode */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '2px' }}>Dark Mode</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Toggle light/dark theme</div>
              </div>
              <button onClick={() => setDarkMode(!darkMode)} style={{ ...styles.btn, ...styles.btnSecondary, padding: '8px 16px' }}>{darkMode ? '☀️ Light' : '🌙 Dark'}</button>
            </div>
          </div>
          {isAdmin && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: `1px solid var(--border-color)`, padding: '20px' }}>
              <h3 style={{ ...styles.cardTitle, marginBottom: '4px' }}>User Management</h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Manage who can access ServerCTL</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px auto', gap: '10px', marginBottom: '16px', alignItems: 'end' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>USERNAME</div>
                  <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="username" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>PASSWORD</div>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="password" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>ROLE</div>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ ...styles.input }}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button onClick={createUser} style={{ ...styles.btn, ...styles.btnPrimary, alignSelf: 'end' }}>Add</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--border-color)` }}>
                    {['Username', 'Role', 'Action'].map(h => <th key={h} style={{ ...styles.th, background: 'transparent' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.username} style={{ borderBottom: `1px solid var(--border-color)20` }}>
                      <td style={styles.td}><strong>{u.username}</strong> {u.username === user?.username && <span style={{ fontSize: '11px', color: '#00d4ff' }}>(you)</span>}</td>
                      <td style={styles.td}>
                        <span style={{ background: u.role === 'admin' ? '#00d4ff20' : '#00ff8820', color: u.role === 'admin' ? '#00d4ff' : '#00ff88', padding: '2px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>{u.role}</span>
                      </td>
                      <td style={styles.td}>
                        {u.username !== user?.username && (
                          <button onClick={() => deleteUser(u.username)} style={{ ...styles.btn, padding: '3px 10px', fontSize: '12px', background: '#ff2d5520', color: '#ff2d55', border: 'none' }}>Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: `1px solid var(--border-color)`, padding: '20px' }}>
            <h3 style={{ ...styles.cardTitle, marginBottom: '12px' }}>Account</h3>
            <div style={{ fontSize: '13px', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Logged in as:</span> <strong>{user?.username}</strong></div>
            <div style={{ fontSize: '13px', marginBottom: '16px' }}><span style={{ color: 'var(--text-muted)' }}>Role:</span> <span style={{ background: isAdmin ? '#00d4ff20' : '#00ff8820', color: isAdmin ? '#00d4ff' : '#00ff88', padding: '1px 8px', borderRadius: '8px', fontWeight: '600' }}>{user?.role}</span></div>
            <button onClick={handleLogout} style={{ ...styles.btn, background: '#ff2d5520', color: '#ff2d55', border: 'none' }}>Sign Out</button>
          </div>
        </div>
      )}

      {/* ── MANAGE section (full-width server detail) ── */}
      {navSection === 'manage' && selectedServer && (() => {
        const Section = ({ title, children }) => (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', paddingBottom: '6px', borderBottom: `1px solid var(--border-color)` }}>{title}</div>
            {children}
          </div>
        );
        const Row = ({ label, value }) => (
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px', padding: '6px 0', borderBottom: `1px solid var(--border-color)15` }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>{label}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace', wordBreak: 'break-all' }}>{value || '—'}</div>
          </div>
        );
        return (
          <div>
            {/* Server header bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px 16px', background: darkMode ? 'rgba(22,22,42,0.7)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', borderRadius: '12px', border: `1px solid var(--border-color)` }}>
              <button onClick={() => { setSelectedServer(null); setNavSection('servers'); }} style={{ ...styles.btn, ...styles.btnSecondary, padding: '5px 12px', fontSize: '12px', flexShrink: 0 }}>← Back</button>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: selectedServer.online ? '#00ff88' : '#ff2d55', boxShadow: selectedServer.online ? '0 0 8px #00ff8880' : 'none', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', fontSize: '15px' }}>{String(selectedServer.name || '')}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace' }}>{String(selectedServer.host || '')} · {String(selectedServer.platform || 'Linux')}</div>
              </div>
              {selectedServer.pending_updates?.count > 0 && (
                <span style={{ background: '#ffb80020', color: '#ffb800', fontSize: '11px', padding: '2px 8px', borderRadius: '8px', fontWeight: '700', border: '1px solid #ffb80040', flexShrink: 0 }}>↑ {selectedServer.pending_updates.count} updates</span>
              )}
              {isAdmin && <button onClick={() => handleDelete(selectedServer.id)} style={{ ...styles.btn, background: '#ff2d552020', color: '#ff2d55', border: '1px solid #ff2d5530', padding: '5px 12px', fontSize: '12px', flexShrink: 0 }}>Delete</button>}
            </div>

            {/* Quick metrics strip */}
            {(() => {
              const sm = serverMetricsMap[selectedServer.id];
              if (!sm) return null;
              return (
                <div className="grid-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                  {[
                    { label: 'CPU', val: sm.cpu_percent, unit: '%', color: '#00d4ff' },
                    { label: 'RAM', val: sm.ram_percent, unit: '%', sub: `${sm.ram_used_gb}/${sm.ram_total_gb} GB`, color: '#c084fc' },
                    { label: 'Disk', val: sm.disk_percent, unit: '%', sub: `${sm.disk_used_gb}/${sm.disk_total_gb} GB`, color: '#ffb800' },
                  ].map(m => (
                    <div key={m.label} style={{ background: darkMode ? 'rgba(22,22,42,0.7)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', borderRadius: '8px', padding: '10px 14px', border: `1px solid var(--border-color)` }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '6px' }}>{m.label}</div>
                      <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border-color)', marginBottom: '6px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${m.val || 0}%`, background: m.color, transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: m.color }}>{m.val}{m.unit}</div>
                      {m.sub && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{m.sub}</div>}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Tabs */}
            <div style={styles.tabs}>
              {[
                { key: 'overview', label: 'Overview', action: () => setActiveTab('overview') },
                { key: 'logs', label: 'Logs', action: () => { setActiveTab('logs'); fetchLogs(); } },
                { key: 'services', label: 'Services', action: () => { setActiveTab('services'); fetchServices(); } },
                { key: 'docker', label: 'Docker', action: () => { setActiveTab('docker'); fetchDocker(); } },
                { key: 'actions', label: 'Actions', action: () => setActiveTab('actions') },
                { key: 'network', label: 'Network', action: () => setActiveTab('network') },
                { key: 'agent', label: 'Agent', action: () => { setActiveTab('agent'); fetchAgentInfo(); } },
              ].map(({ key, label, action }) => (
                <button
                  key={key}
                  onClick={action}
                  onMouseEnter={() => setTabHover(key)}
                  onMouseLeave={() => setTabHover(null)}
                  style={styles.tab(activeTab === key, tabHover === key)}
                >{label}</button>
              ))}
            </div>

            {/* Overview = sysinfo + Zabbix */}
            {activeTab === 'overview' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                  <button onClick={() => fetchSysInfo()} style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '12px', padding: '4px 12px' }}>↺ Refresh Info</button>
                </div>

                {sysInfoLoading && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading system information...</div>}
                {!sysInfoLoading && !sysInfo && (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '13px', marginBottom: '12px' }}>Connect the agent or click Refresh to load system info.</div>
                    <button onClick={() => fetchSysInfo()} style={{ ...styles.btn, ...styles.btnPrimary }}>Load Info</button>
                  </div>
                )}
                {sysInfo && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                    <div>
                      <Section title="System Information">
                        <Row label="Architecture" value={sysInfo.architecture} />
                        <Row label="Running Kernel" value={sysInfo.kernel_running} />
                        {sysInfo.kernel_installed && sysInfo.kernel_installed !== sysInfo.kernel_running && (
                          <Row label="Installed Kernel" value={sysInfo.kernel_installed} />
                        )}
                        <Row label="SELinux Status" value={sysInfo.selinux} />
                      </Section>
                      <Section title="Resource Information">
                        <Row label="System Uptime" value={sysInfo.uptime} />
                        <Row label="CPU Model" value={sysInfo.cpu_model} />
                        <Row label="CPU Cores" value={sysInfo.cpu_cores ? `${sysInfo.cpu_cores} logical${sysInfo.cpu_cores_physical ? ` / ${sysInfo.cpu_cores_physical} physical` : ''}` : undefined} />
                        <Row label="RAM Installed" value={sysInfo.ram_total_gib != null ? `${sysInfo.ram_total_gib} GiB` : undefined} />
                        <Row label="Swap Size" value={sysInfo.swap_total_gib != null ? `${sysInfo.swap_total_gib} GiB` : undefined} />
                        <Row label="Load Average" value={sysInfo.load_avg} />
                      </Section>
                      <Section title="Disk Usage">
                        {(sysInfo.disks || []).length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No disk data</div>}
                        {(sysInfo.disks || []).map((d, i) => (
                          <div key={i} style={{ marginBottom: '10px', padding: '10px 12px', background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)', borderRadius: '8px', border: `1px solid var(--border-color)` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{d.device}</span>
                              <span style={{ fontSize: '12px', color: parseInt(d.pct) >= 90 ? '#ff2d55' : parseInt(d.pct) >= 75 ? '#ffb800' : 'var(--color-success)' }}>{d.pct} used</span>
                            </div>
                            <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', marginBottom: '6px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: d.pct, background: parseInt(d.pct) >= 90 ? '#ff2d55' : parseInt(d.pct) >= 75 ? '#ffb800' : '#00ff88', borderRadius: '2px', transition: 'width 0.3s' }} />
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Size: {d.total_gb}GB ({d.used_gb}GB used, {d.free_gb}GB free)</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Mount: {d.mount}</div>
                          </div>
                        ))}
                      </Section>
                    </div>
                    <div>
                      <Section title="Network — DNS Servers">
                        {(sysInfo.dns_servers || []).length === 0
                          ? <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>None found</div>
                          : (sysInfo.dns_servers || []).map((dns, i) => (
                            <div key={i} style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', padding: '4px 0', color: 'var(--text-primary)' }}>{dns}</div>
                          ))}
                      </Section>
                      <Section title="Network Interfaces">
                        {(sysInfo.interfaces || []).filter(iface => iface.type !== 'loopback').map((iface, i) => (
                          <div key={i} style={{ marginBottom: '12px', padding: '10px 12px', background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)', borderRadius: '8px', border: `1px solid var(--border-color)` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{iface.name}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{iface.type}</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', padding: '1px 7px', borderRadius: '8px', background: iface.up ? '#00ff8820' : '#ff2d5520', color: iface.up ? '#00ff88' : '#ff2d55' }}>{iface.up ? 'UP' : 'DOWN'}</span>
                            </div>
                            {iface.mac && <Row label="MAC Address" value={iface.mac} />}
                            <Row label="MTU" value={String(iface.mtu)} />
                            {iface.addresses.length > 0 && (
                              <div style={{ marginTop: '6px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', marginBottom: '4px' }}>IP Addresses</div>
                                {iface.addresses.map((addr, j) => (
                                  <div key={j} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: '6px', padding: '3px 0', fontSize: '12px' }}>
                                    <span style={{ color: addr.family === 'inet' ? '#60a5fa' : '#c084fc', fontFamily: '"JetBrains Mono", monospace', fontWeight: '600' }}>{addr.family}</span>
                                    <span style={{ fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-primary)' }}>{addr.address}{iface.gateway && addr.family === 'inet' ? ` — Gateway: ${iface.gateway}` : ''}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </Section>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'logs' && (
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Log Files</span>
                    <button onClick={fetchLogs} style={{ ...styles.btn, padding: '4px 8px', fontSize: '11px', ...styles.btnSecondary }} disabled={logsLoading}>↺</button>
                  </div>
                  {logsLoading && !selectedLog && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</div>}
                  {availableLogs.map((log, i) => (
                    <div key={i} onClick={() => fetchLogContent(log.path)}
                      style={{ padding: '8px 10px', borderRadius: '6px', marginBottom: '4px', cursor: 'pointer', background: selectedLog === log.path ? 'var(--color-primary)' : 'var(--bg-card-hover)', color: selectedLog === log.path ? '#fff' : 'var(--text-primary)', fontSize: '13px' }}>
                      <div style={{ fontWeight: '500' }}>{log.name}</div>
                      <div style={{ fontSize: '11px', opacity: 0.7 }}>{(log.size / 1024).toFixed(1)} KB</div>
                    </div>
                  ))}
                </div>
                <div>
                  {logsLoading && selectedLog && <div style={styles.empty}>Loading...</div>}
                  {logsOutput && <div style={{ ...styles.sshTerminal, minHeight: '400px' }}>{logsOutput}</div>}
                </div>
              </div>
            )}

            {activeTab === 'services' && (
              <div style={{ position: 'relative' }}>
                {/* Service list */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>{servicesList.length} Services</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="Filter services..."
                      value={serviceFilter || ''}
                      onChange={e => setServiceFilter(e.target.value)}
                      style={{ ...styles.input, padding: '4px 8px', fontSize: '11px', width: '160px' }}
                    />
                    <button onClick={fetchServices} style={{ ...styles.btn, padding: '4px 8px', fontSize: '11px', ...styles.btnSecondary }}>↺</button>
                  </div>
                </div>
                {servicesLoading && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '4px', maxHeight: '60vh', overflowY: 'auto', padding: '4px 0' }}>
                  {servicesList.filter(svc => !serviceFilter || svc.toLowerCase().includes(serviceFilter.toLowerCase())).map((svc, i) => (
                    <div key={i} onClick={() => { fetchServiceDetail(svc); setServiceFloatingOpen(true); }}
                      style={{ padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', background: selectedService === svc ? 'var(--color-primary)' : 'var(--bg-card-hover)', color: selectedService === svc ? '#fff' : 'var(--text-primary)', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'background 0.1s' }}>
                      {svc}
                    </div>
                  ))}
                </div>

                {/* Floating service detail panel */}
                {serviceFloatingOpen && selectedService && (
                  <div style={{ position: 'fixed', bottom: '20px', right: '20px', width: '624px', maxWidth: 'calc(100vw - 40px)', maxHeight: '72vh', background: 'var(--bg-card)', border: `1px solid var(--border-color)`, borderRadius: '12px', boxShadow: '0 16px 48px rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid var(--border-color)`, background: darkMode ? '#131325' : '#f0f0f0', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedService}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => fetchServiceDetail(selectedService)} style={{ ...styles.btn, padding: '3px 8px', fontSize: '10px', ...styles.btnSecondary }}>↺</button>
                        <button onClick={() => setServiceFloatingOpen(false)} style={{ ...styles.btn, padding: '3px 8px', fontSize: '10px', ...styles.btnSecondary }}>✕</button>
                      </div>
                    </div>
                    {/* Content */}
                    <pre style={{ margin: 0, padding: '12px 14px', flex: 1, overflowY: 'auto', fontSize: '11px', lineHeight: '1.6', fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: darkMode ? '#1a1a1a' : '#f5f5f0' }}>
                      {serviceDetail || 'Click a service to view details...'}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'docker' && (
              <div>
                <button onClick={fetchDocker} style={{ ...styles.btn, ...styles.btnSecondary, marginBottom: '12px' }} disabled={dockerLoading}>↺ Refresh</button>
                {dockerLoading && <div style={styles.empty}>Loading...</div>}
                {dockerContainers.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead><tr>
                        {['Name', 'Image', 'Status'].map(h => <th key={h} style={styles.th}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {dockerContainers.map((ct, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid var(--border-color)20` }}>
                            <td style={{ ...styles.td, fontFamily: '"JetBrains Mono", monospace', fontWeight: '600' }}>{ct.name}</td>
                            <td style={{ ...styles.td, fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{ct.image}</td>
                            <td style={{ ...styles.td }}>
                              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', fontWeight: '700', background: ct.status?.startsWith('Up') ? '#00ff8820' : '#ff2d5520', color: ct.status?.startsWith('Up') ? '#00ff88' : '#ff2d55' }}>{ct.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!dockerLoading && dockerContainers.length === 0 && <div style={styles.empty}><div style={{ opacity: 0.4 }}>No containers found</div></div>}
              </div>
            )}

            {activeTab === 'actions' && (
              <div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px', padding: '4px', background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: '12px' }}>
                  {(() => {
                    const isWindows = String(selectedServer?.platform || '').toLowerCase().includes('windows');
                    const commonActions = [
                      { label: 'System Info', cmd: 'system_info', icon: '🖥' },
                      { label: 'Disk Usage', cmd: 'disk_usage', icon: '💾' },
                      { label: 'Memory', cmd: 'memory', icon: '⚡' },
                      { label: 'CPU Info', cmd: 'cpu_info', icon: '🔧' },
                    ];
                    const adminActions = isAdmin ? [
                      { label: 'Check Updates', cmd: '__check_updates__', icon: '🔄' },
                      { label: 'Upgrade Now', cmd: '__upgrade__', icon: '⬆', green: true },
                    ] : [];
                    return [...commonActions, ...adminActions];
                  })().map(({ label, cmd, icon, green, danger }) => {
                    const isActive = activeAction === cmd;
                    const isHover = actionBtnHover === cmd;
                    const isUpgrade = cmd === '__upgrade__';
                    const isUpdateAgent = cmd === '__update_agent__';
                    const isUninstallAgent = cmd === '__uninstall_agent__';
                    const isCheckUpdates = cmd === '__check_updates__';
                    const handleClick = () => {
                      setActiveAction(cmd);
                      setUpgradeOutput('');
                      setActionOutput('');
                      setActionView(null);
                      if (isUpgrade) handleUpgrade();
                      else if (isUpdateAgent) handleUpdateAgent();
                      else if (isUninstallAgent) handleUninstallAgent();
                      else if (isCheckUpdates) { showUpdates(); }
                      else { runAction(cmd); }
                    };
                    return (
                      <button key={cmd}
                        onClick={handleClick}
                        onMouseEnter={() => setActionBtnHover(cmd)}
                        onMouseLeave={() => setActionBtnHover(null)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                          fontSize: '13px', fontWeight: isActive ? '600' : '500',
                          background: danger
                            ? (isActive ? '#ff2d55' : isHover ? '#ff2d55' : '#ff2d5520')
                            : isUpgrade
                            ? (isActive ? '#81c8be' : isHover ? '#00ff88' : '#00ff8820')
                            : (isActive ? 'var(--color-primary)' : isHover ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : 'transparent'),
                          color: danger
                            ? (isActive || isHover ? '#fff' : '#ff2d55')
                            : isUpgrade
                            ? (isActive || isHover ? '#fff' : '#00ff88')
                            : (isActive ? '#fff' : isHover ? 'var(--text-primary)' : 'var(--text-muted)'),
                          transition: 'all 0.15s',
                          boxShadow: isActive ? '0 2px 8px rgba(163,190,60,0.3)' : 'none',
                        }}>
                        <span style={{ fontSize: '14px' }}>{icon}</span>
                        {isUpgrade && upgradeLoading ? 'Upgrading...' : label}
                      </button>
                    );
                  })}
                </div>
                {/* Running upgrade indicator */}
                {upgradeLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', background: darkMode ? 'rgba(0,217,126,0.06)' : 'rgba(0,217,126,0.06)', border: '1px solid #00ff8840', borderRadius: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00ff88', animation: 'pulse 1s infinite', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#00ff88', letterSpacing: '0.06em' }}>UPGRADE IN PROGRESS</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Installing packages — do not close this window</div>
                    </div>
                  </div>
                )}

                {/* Upgrade result */}
                {upgradeOutput && !upgradeLoading && (
                  <div style={{ background: darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)', border: `1px solid var(--border-color)`, borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', borderBottom: `1px solid var(--border-color)`, display: 'flex', alignItems: 'center', gap: '8px', background: darkMode ? 'rgba(0,217,126,0.06)' : 'rgba(0,217,126,0.06)' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff88' }} />
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#00ff88', letterSpacing: '0.1em' }}>UPGRADE COMPLETE</span>
                    </div>
                    <pre style={{ margin: 0, padding: '14px 16px', background: 'transparent', color: 'var(--text-primary)', fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '360px', overflow: 'auto' }}>{upgradeOutput}</pre>
                  </div>
                )}

                {/* Check updates result */}
                {!actionLoading && updatesData && activeAction === '__check_updates__' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Summary card */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                      {[
                        { label: 'PACKAGES AVAILABLE', value: updatesData.packages.length, color: updatesData.packages.length > 0 ? '#ffb800' : '#00ff88' },
                        { label: 'REPOS FETCHED', value: updatesData.fetched, color: '#71717A' },
                        { label: 'STATUS', value: updatesData.success ? 'OK' : 'ERROR', color: updatesData.success ? '#00ff88' : '#ff2d55' },
                      ].map(s => (
                        <div key={s.label} style={{ padding: '14px 16px', background: darkMode ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', border: `1px solid ${s.color}30`, borderRadius: '12px' }}>
                          <div style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: '6px' }}>{s.label}</div>
                          <div style={{ fontSize: '22px', fontWeight: '800', color: s.color }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                    {/* Package list */}
                    {updatesData.packages.length > 0 && (
                      <div style={{ border: `1px solid var(--border-color)`, borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '8px 16px', borderBottom: `1px solid var(--border-color)`, fontSize: '10px', letterSpacing: '0.15em', color: '#ffb800', background: darkMode ? 'rgba(255,192,72,0.06)' : 'rgba(255,192,72,0.04)' }}>
                          AVAILABLE UPDATES — {updatesData.packages.length} package{updatesData.packages.length !== 1 ? 's' : ''}
                        </div>
                        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                          {updatesData.packages.map((p, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 16px', borderBottom: `1px solid var(--border-color)20`, background: i % 2 === 0 ? 'transparent' : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600' }}>{p.name}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono",monospace' }}>{p.version}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {updatesData.packages.length === 0 && (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#00ff88', fontSize: '13px', border: '1px solid #00ff8830', borderRadius: '12px' }}>
                        ✓ System is up to date
                      </div>
                    )}
                  </div>
                )}

                {actionLoading && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Running...</div>}
                {!actionLoading && actionOutput && !upgradeOutput && activeAction !== '__check_updates__' && <ActionOutput text={actionOutput} />}
              </div>
            )}

            {activeTab === 'network' && (
              <div>
                {/* Sub-tabs */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', padding: '4px', background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: '12px' }}>
                  {[
                    { key: 'ip', label: 'IP Information', icon: '⬡' },
                    { key: 'ports', label: 'Listening Ports', icon: '▦' },
                    { key: 'firewall', label: 'Firewall', icon: '⛊' },
                    { key: 'tools', label: 'Tools', icon: '>_' },
                  ].map(sub => {
                    const active = networkSubTab === sub.key;
                    return (
                      <button key={sub.key}
                        onClick={() => {
                          setNetworkSubTab(sub.key);
                          setNetworkInfoOutput('');
                          if (sub.key === 'ip') fetchNetworkInfo('ip_info');
                          else if (sub.key === 'ports') fetchNetworkInfo('listening_ports');
                          else if (sub.key === 'firewall') fetchNetworkInfo('firewall_status');
                        }}
                        style={{
                          padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: active ? '700' : '500',
                          background: active ? 'var(--color-primary)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)',
                          borderRadius: '8px',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                        <span style={{ fontSize: '13px' }}>{sub.icon}</span> {sub.label}
                      </button>
                    );
                  })}
                </div>

                {/* IP Info / Ports / Firewall — Modern Design */}
                {networkSubTab !== 'tools' && (
                  <div>
                    {networkInfoLoading && (
                      <div style={{ padding: '40px', textAlign: 'center' }}>
                        <div style={{ width: '32px', height: '32px', border: `3px solid var(--border-color)`, borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</div>
                      </div>
                    )}
                    {!networkInfoLoading && networkInfoOutput && networkSubTab === 'ip' && (() => {
                      const lines = networkInfoOutput.split('\n').filter(l => l.trim());
                      const interfaces = [];
                      let gateway = '';
                      let dnsServers = [];
                      // Parse Linux ip -br addr format: "eth0  UP  192.168.1.x/24"
                      // Parse key:value lines, gateway, dns
                      lines.forEach(line => {
                        const l = line.trim();
                        if (l.startsWith('Default Gateway:') || l.match(/^default via/)) {
                          gateway = l.replace('Default Gateway:', '').replace(/^default via\s+/, '').replace(/\s+dev.*/, '').trim();
                        } else if (l.startsWith('nameserver')) {
                          dnsServers.push(l.replace('nameserver', '').trim());
                        } else if (l.match(/^\d+:\s/) || l.match(/^[a-zA-Z]/) && (l.includes('UP') || l.includes('DOWN') || l.includes('/') || l.includes('inet') || l.includes('InterfaceAlias'))) {
                          // ip -br addr line: "eth0  UP  10.0.0.1/24 fe80::1/64"
                          const parts = l.split(/\s+/);
                          if (parts.length >= 2) {
                            const name = parts[0].replace(/^\d+:\s*/, '');
                            const state = parts[1];
                            const addrs = parts.slice(2).filter(p => p.includes('.') || p.includes(':'));
                            if (addrs.length > 0 || state === 'UP' || state === 'DOWN') {
                              interfaces.push({ name, state, addresses: addrs });
                            }
                          }
                        }
                      });
                      // Windows format: key : value pairs grouped by interface
                      if (interfaces.length === 0 && networkInfoOutput.includes(':')) {
                        let current = {};
                        lines.forEach(l => {
                          const kv = l.match(/^(\w[\w\s]*?)\s*:\s*(.+)/);
                          if (kv) {
                            const k = kv[1].trim(), v = kv[2].trim();
                            if (k === 'InterfaceAlias') {
                              if (current.name) interfaces.push(current);
                              current = { name: v, state: 'UP', addresses: [] };
                            } else if (k.includes('IPv4') && !k.includes('Gateway')) {
                              current.addresses.push(v.replace(/[{}]/g, ''));
                            } else if (k.includes('Gateway')) {
                              gateway = gateway || v.replace(/[{}]/g, '');
                            } else if (k.includes('DNS')) {
                              dnsServers.push(v.replace(/[{}]/g, ''));
                            }
                          }
                        });
                        if (current.name) interfaces.push(current);
                      }
                      // Fallback: if we couldn't parse, show raw
                      if (interfaces.length === 0 && !gateway && dnsServers.length === 0) {
                        return <pre style={{ margin: 0, padding: '16px', background: darkMode ? '#1a1a1a' : '#f5f5f0', border: `1px solid var(--border-color)`, color: 'var(--text-primary)', fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '500px', overflow: 'auto', fontFamily: '"JetBrains Mono",monospace', borderRadius: '12px' }}>{networkInfoOutput}</pre>;
                      }
                      return (
                        <div style={{ display: 'grid', gap: '12px' }}>
                          {/* Interface cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                            {interfaces.map((iface, i) => (
                              <div key={i} style={{ padding: '16px', background: darkMode ? '#1a1a1a' : '#fff', border: `1px solid var(--border-color)`, borderRadius: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{iface.name}</span>
                                  <span style={{ fontSize: '10px', padding: '2px 10px', borderRadius: '9999px', fontWeight: '700',
                                    background: iface.state === 'UP' ? '#00ff8820' : '#ff2d5520',
                                    color: iface.state === 'UP' ? '#00ff88' : '#ff2d55'
                                  }}>{iface.state}</span>
                                </div>
                                {iface.addresses.map((addr, j) => (
                                  <div key={j} style={{ fontSize: '13px', fontFamily: '"JetBrains Mono",monospace', color: addr.includes(':') ? 'var(--text-muted)' : 'var(--color-primary)', padding: '3px 0' }}>
                                    {addr}
                                  </div>
                                ))}
                                {iface.addresses.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No address</div>}
                              </div>
                            ))}
                          </div>
                          {/* Gateway & DNS row */}
                          <div style={{ display: 'grid', gridTemplateColumns: gateway && dnsServers.length > 0 ? '1fr 1fr' : '1fr', gap: '12px' }}>
                            {gateway && (
                              <div style={{ padding: '14px 16px', background: darkMode ? '#1a1a1a' : '#fff', border: `1px solid var(--border-color)`, borderRadius: '12px' }}>
                                <div style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>DEFAULT GATEWAY</div>
                                <div style={{ fontSize: '15px', fontWeight: '700', fontFamily: '"JetBrains Mono",monospace', color: '#00d4ff' }}>{gateway}</div>
                              </div>
                            )}
                            {dnsServers.length > 0 && (
                              <div style={{ padding: '14px 16px', background: darkMode ? '#1a1a1a' : '#fff', border: `1px solid var(--border-color)`, borderRadius: '12px' }}>
                                <div style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>DNS SERVERS</div>
                                {dnsServers.map((dns, i) => (
                                  <div key={i} style={{ fontSize: '13px', fontFamily: '"JetBrains Mono",monospace', color: 'var(--text-primary)', padding: '2px 0' }}>{dns}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {!networkInfoLoading && networkInfoOutput && networkSubTab === 'ports' && (() => {
                      const lines = networkInfoOutput.split('\n').filter(l => l.trim());
                      const ports = [];
                      // Parse ss/netstat: "tcp  LISTEN  0  128  0.0.0.0:22  0.0.0.0:*  users:(("sshd",...))"
                      // Parse Windows: "LocalAddress  LocalPort  OwningProcess"
                      const isWindows = lines[0]?.includes('LocalAddress') || lines[0]?.includes('LocalPort');
                      if (isWindows) {
                        const dataLines = lines.filter(l => !l.startsWith('Local') && !l.startsWith('---'));
                        dataLines.forEach(l => {
                          const parts = l.trim().split(/\s+/);
                          if (parts.length >= 3) {
                            ports.push({ proto: 'tcp', addr: parts[0], port: parts[1], process: `PID ${parts[2]}` });
                          }
                        });
                      } else {
                        lines.forEach(l => {
                          const parts = l.trim().split(/\s+/);
                          if ((parts[0] === 'tcp' || parts[0] === 'udp' || parts[0] === 'tcp6' || parts[0] === 'udp6') && parts.length >= 5) {
                            const localAddr = parts[4] || parts[3];
                            const lastColon = localAddr.lastIndexOf(':');
                            const addr = lastColon > 0 ? localAddr.substring(0, lastColon) : '*';
                            const port = lastColon > 0 ? localAddr.substring(lastColon + 1) : localAddr;
                            const proc = parts.slice(6).join(' ').replace(/users:\(\("|"\)\)/g, '').replace(/",pid=\d+,fd=\d+/g, '') || '';
                            ports.push({ proto: parts[0], addr, port, process: proc });
                          }
                        });
                      }
                      if (ports.length === 0) {
                        return <pre style={{ margin: 0, padding: '16px', background: darkMode ? '#1a1a1a' : '#f5f5f0', border: `1px solid var(--border-color)`, color: 'var(--text-primary)', fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '500px', overflow: 'auto', fontFamily: '"JetBrains Mono",monospace', borderRadius: '12px' }}>{networkInfoOutput}</pre>;
                      }
                      return (
                        <div style={{ border: `1px solid var(--border-color)`, borderRadius: '12px', overflow: 'hidden' }}>
                          <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                              <thead>
                                <tr style={{ background: darkMode ? '#131325' : '#f0f0f0', position: 'sticky', top: 0 }}>
                                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: '700', borderBottom: `1px solid var(--border-color)` }}>PROTO</th>
                                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: '700', borderBottom: `1px solid var(--border-color)` }}>ADDRESS</th>
                                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: '700', borderBottom: `1px solid var(--border-color)` }}>PORT</th>
                                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: '700', borderBottom: `1px solid var(--border-color)` }}>PROCESS</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ports.map((p, i) => (
                                  <tr key={i} style={{ borderBottom: `1px solid var(--border-color)20`, background: i % 2 === 0 ? 'transparent' : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') }}>
                                    <td style={{ padding: '8px 14px', fontFamily: '"JetBrains Mono",monospace' }}>
                                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', fontWeight: '700', background: p.proto.startsWith('tcp') ? '#00d4ff20' : '#ffb80020', color: p.proto.startsWith('tcp') ? '#00d4ff' : '#ffb800' }}>{p.proto.toUpperCase()}</span>
                                    </td>
                                    <td style={{ padding: '8px 14px', fontFamily: '"JetBrains Mono",monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{p.addr}</td>
                                    <td style={{ padding: '8px 14px', fontFamily: '"JetBrains Mono",monospace', fontSize: '13px', fontWeight: '700', color: 'var(--color-primary)' }}>{p.port}</td>
                                    <td style={{ padding: '8px 14px', fontFamily: '"JetBrains Mono",monospace', fontSize: '11px', color: 'var(--text-muted)' }}>{p.process}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div style={{ padding: '8px 14px', borderTop: `1px solid var(--border-color)`, fontSize: '11px', color: 'var(--text-muted)', background: darkMode ? '#1a1a1a' : '#f5f5f0' }}>
                            {ports.length} listening port{ports.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      );
                    })()}
                    {!networkInfoLoading && networkInfoOutput && networkSubTab === 'firewall' && (() => {
                      const lines = networkInfoOutput.split('\n').filter(l => l.trim());
                      const isUfw = lines.some(l => l.includes('Status:'));
                      const isWindows = lines.some(l => l.includes('Name') && l.includes('Enabled'));
                      const statusLine = isUfw ? lines.find(l => l.includes('Status:')) : null;
                      const status = statusLine?.split(':')[1]?.trim() || (isWindows ? 'active' : 'unknown');
                      const defaultLine = isUfw ? lines.find(l => l.toLowerCase().includes('default:')) : null;

                      // Parse ufw rules
                      const rules = [];
                      if (isUfw) {
                        let inRules = false;
                        lines.forEach(l => {
                          if (l.startsWith('--')) { inRules = true; return; }
                          if (inRules && l.trim()) {
                            const parts = l.trim().split(/\s{2,}/);
                            rules.push({ to: parts[0] || '', action: parts[1] || '', from: parts[2] || '' });
                          }
                        });
                      }

                      // Parse Windows profiles
                      const profiles = [];
                      if (isWindows) {
                        const dataLines = lines.filter(l => !l.startsWith('Name') && !l.startsWith('---') && !l.startsWith('-'));
                        dataLines.forEach(l => {
                          const parts = l.trim().split(/\s+/);
                          if (parts.length >= 4) profiles.push({ name: parts[0], enabled: parts[1], inbound: parts[2], outbound: parts[3] });
                        });
                      }

                      const fwRunAction = async (cmd) => {
                        setFwLoading(true); setFwResult('');
                        try {
                          const data = await agentAction(cmd);
                          setFwResult(data.output || data.detail || 'Done');
                          fetchNetworkInfo('firewall_status');
                        } catch (e) { setFwResult('Error: ' + e.message); }
                        setFwLoading(false);
                      };

                      const isFallback = !isUfw && !isWindows;

                      return (
                        <div style={{ display: 'grid', gap: '16px' }}>
                          {/* Status + Enable/Disable row */}
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'stretch' }}>
                            <div style={{ padding: '16px 20px', background: darkMode ? '#1a1a1a' : '#fff', border: `1px solid var(--border-color)`, borderRadius: '12px', minWidth: '140px' }}>
                              <div style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>STATUS</div>
                              <div style={{ fontSize: '20px', fontWeight: '800', color: status === 'active' ? '#00ff88' : status === 'inactive' ? '#ff2d55' : '#ffb800' }}>{status.toUpperCase()}</div>
                            </div>
                            {defaultLine && (
                              <div style={{ padding: '16px 20px', background: darkMode ? '#1a1a1a' : '#fff', border: `1px solid var(--border-color)`, borderRadius: '12px', minWidth: '200px' }}>
                                <div style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>DEFAULT POLICY</div>
                                <div style={{ fontSize: '12px', fontFamily: '"JetBrains Mono",monospace', color: 'var(--text-primary)' }}>{defaultLine.replace(/Default:\s*/i, '')}</div>
                              </div>
                            )}
                            {isAdmin && (
                              <div style={{ padding: '16px 20px', background: darkMode ? '#1a1a1a' : '#fff', border: `1px solid var(--border-color)`, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button onClick={() => fwRunAction('firewall:enable')} disabled={fwLoading}
                                  style={{ ...styles.btn, padding: '8px 16px', fontSize: '12px', fontWeight: '700', background: '#00d4ff', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: fwLoading ? 0.5 : 1 }}>
                                  Enable
                                </button>
                                <button onClick={() => fwRunAction('firewall:disable')} disabled={fwLoading}
                                  style={{ ...styles.btn, padding: '8px 16px', fontSize: '12px', fontWeight: '700', background: '#ff2d55', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: fwLoading ? 0.5 : 1 }}>
                                  Disable
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Add Rule form */}
                          {isAdmin && (
                            <div style={{ border: `1px solid var(--border-color)`, borderRadius: '12px', overflow: 'hidden' }}>
                              <div style={{ padding: '10px 14px', borderBottom: `1px solid var(--border-color)`, fontSize: '10px', letterSpacing: '0.12em', color: 'var(--color-primary)', fontWeight: '700', background: darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.04)' }}>ADD RULE</div>
                              <div style={{ padding: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Action</div>
                                  <select value={fwAction} onChange={e => setFwAction(e.target.value)} style={{ ...styles.input, padding: '7px 10px', fontSize: '12px', width: '100px' }}>
                                    <option value="allow">Allow</option>
                                    <option value="deny">Deny</option>
                                  </select>
                                </div>
                                <div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Direction</div>
                                  <select value={fwDirection} onChange={e => setFwDirection(e.target.value)} style={{ ...styles.input, padding: '7px 10px', fontSize: '12px', width: '100px' }}>
                                    <option value="in">Inbound</option>
                                    <option value="out">Outbound</option>
                                  </select>
                                </div>
                                <div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Protocol</div>
                                  <select value={fwProto} onChange={e => setFwProto(e.target.value)} style={{ ...styles.input, padding: '7px 10px', fontSize: '12px', width: '90px' }}>
                                    <option value="tcp">TCP</option>
                                    <option value="udp">UDP</option>
                                  </select>
                                </div>
                                <div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Port</div>
                                  <input type="text" value={fwPort} onChange={e => setFwPort(e.target.value)} placeholder="e.g. 8080"
                                    style={{ ...styles.input, padding: '7px 10px', fontSize: '12px', width: '100px' }} />
                                </div>
                                <button onClick={() => {
                                  if (!fwPort) return;
                                  fwRunAction(`firewall:add:${fwAction},${fwDirection},${fwProto},${fwPort}`);
                                  setFwPort('');
                                }} disabled={fwLoading || !fwPort}
                                  style={{ ...styles.btn, padding: '7px 18px', fontSize: '12px', fontWeight: '700', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: (fwLoading || !fwPort) ? 0.5 : 1 }}>
                                  Add Rule
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Result output */}
                          {fwResult && (
                            <div style={{ padding: '12px 14px', background: darkMode ? '#1a1a1a' : '#f5f5f0', border: `1px solid var(--border-color)`, borderRadius: '10px', fontSize: '12px', fontFamily: '"JetBrains Mono",monospace', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {fwResult}
                            </div>
                          )}

                          {/* Windows profiles */}
                          {profiles.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                              {profiles.map((p, i) => (
                                <div key={i} style={{ padding: '16px', background: darkMode ? '#1a1a1a' : '#fff', border: `1px solid var(--border-color)`, borderRadius: '12px' }}>
                                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '10px' }}>{p.name}</div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Enabled</span>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: p.enabled === 'True' ? '#00ff88' : '#ff2d55' }}>{p.enabled}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Inbound</span>
                                    <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '6px', fontWeight: '700',
                                      background: p.inbound === 'Allow' ? '#00ff8820' : '#ff2d5520',
                                      color: p.inbound === 'Allow' ? '#00ff88' : '#ff2d55'
                                    }}>{p.inbound}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Outbound</span>
                                    <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '6px', fontWeight: '700',
                                      background: p.outbound === 'Allow' ? '#00ff8820' : '#ff2d5520',
                                      color: p.outbound === 'Allow' ? '#00ff88' : '#ff2d55'
                                    }}>{p.outbound}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Rules table (ufw) */}
                          {rules.length > 0 && (
                            <div style={{ border: `1px solid var(--border-color)`, borderRadius: '12px', overflow: 'hidden' }}>
                              <div style={{ padding: '10px 14px', borderBottom: `1px solid var(--border-color)`, fontSize: '10px', letterSpacing: '0.12em', color: 'var(--color-primary)', fontWeight: '700', background: darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.04)' }}>FIREWALL RULES</div>
                              <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                    <tr style={{ background: darkMode ? '#131325' : '#f0f0f0' }}>
                                      <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: '700' }}>TO</th>
                                      <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: '700' }}>ACTION</th>
                                      <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: '700' }}>FROM</th>
                                      {isAdmin && <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: '700' }}></th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rules.map((r, i) => (
                                      <tr key={i} style={{ borderBottom: `1px solid var(--border-color)20`, background: i % 2 === 0 ? 'transparent' : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') }}>
                                        <td style={{ padding: '8px 14px', fontFamily: '"JetBrains Mono",monospace', fontWeight: '600' }}>{r.to}</td>
                                        <td style={{ padding: '8px 14px' }}>
                                          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', fontWeight: '700',
                                            background: r.action.includes('ALLOW') ? '#00ff8820' : r.action.includes('DENY') || r.action.includes('REJECT') ? '#ff2d5520' : '#55556e20',
                                            color: r.action.includes('ALLOW') ? '#00ff88' : r.action.includes('DENY') || r.action.includes('REJECT') ? '#ff2d55' : '#55556e'
                                          }}>{r.action}</span>
                                        </td>
                                        <td style={{ padding: '8px 14px', fontFamily: '"JetBrains Mono",monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{r.from}</td>
                                        {isAdmin && (
                                          <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                                            <button onClick={() => {
                                              if (confirm(`Remove rule: ${r.action.toLowerCase().split(' ')[0]} ${r.to}?`)) {
                                                fwRunAction(`firewall:remove:${r.action.toLowerCase().split(' ')[0]} ${r.to}`);
                                              }
                                            }} disabled={fwLoading}
                                              style={{ background: 'none', border: 'none', color: '#ff2d55', cursor: 'pointer', fontSize: '11px', fontWeight: '600', opacity: fwLoading ? 0.5 : 1, padding: '2px 6px', borderRadius: '4px' }}>
                                              Remove
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Fallback raw output */}
                          {isFallback && <pre style={{ margin: 0, padding: '16px', background: darkMode ? '#1a1a1a' : '#f5f5f0', border: `1px solid var(--border-color)`, color: 'var(--text-primary)', fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '500px', overflow: 'auto', fontFamily: '"JetBrains Mono",monospace', borderRadius: '12px' }}>{networkInfoOutput}</pre>}
                        </div>
                      );
                    })()}
                    {!networkInfoLoading && !networkInfoOutput && (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        Select a category above to load network information.
                      </div>
                    )}
                    {!networkInfoLoading && networkInfoOutput && (
                      <button onClick={() => {
                        if (networkSubTab === 'ip') fetchNetworkInfo('ip_info');
                        else if (networkSubTab === 'ports') fetchNetworkInfo('listening_ports');
                        else if (networkSubTab === 'firewall') fetchNetworkInfo('firewall_status');
                      }} style={{ ...styles.btn, ...styles.btnSecondary, marginTop: '12px', fontSize: '11px' }}>
                        ↺ Refresh
                      </button>
                    )}
                  </div>
                )}

                {/* Tools */}
                {networkSubTab === 'tools' && (
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>Tool</label>
                      <select value={networkTool} onChange={e => setNetworkTool(e.target.value)} style={{ ...styles.input, width: '100%', boxSizing: 'border-box', marginBottom: '12px' }}>
                        <option value="ping">Ping</option>
                        <option value="traceroute">Traceroute</option>
                        <option value="nslookup">NSLookup</option>
                      </select>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>Target</label>
                      <input type="text" value={networkTarget} onChange={e => setNetworkTarget(e.target.value)} placeholder="8.8.8.8" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <button onClick={runNetworkTool} style={{ ...styles.btn, ...styles.btnPrimary }} disabled={networkLoading}>Run</button>
                      {networkLoading && <button onClick={stopNetworkTool} style={{ ...styles.btn, ...styles.btnDanger }}>Stop</button>}
                    </div>
                    {networkOutput && <pre style={{ margin: 0, padding: '16px', background: darkMode ? '#1a1a1a' : '#f0f0f0', border: `1px solid var(--border-color)`, color: 'var(--text-primary)', fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '500px', overflow: 'auto', fontFamily: '"JetBrains Mono",monospace', borderRadius: '12px' }}>{networkOutput}</pre>}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'agent' && (
              <div>
                {agentInfoLoading && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading agent info...</div>}
                {agentInfo && !agentInfo.error && (
                  <div>
                    {/* Agent Info Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                      {[
                        { label: 'VERSION', value: agentInfo.version || '?', color: '#00d4ff' },
                        { label: 'UPTIME', value: agentInfo.uptime || '?', color: '#00ff88' },
                        { label: 'PLATFORM', value: `${(agentInfo.os || '').toUpperCase()} / ${agentInfo.arch || ''}`, color: '#71717A' },
                        { label: 'GO VERSION', value: agentInfo.go_version || '?', color: '#4888e8' },
                      ].map(card => (
                        <div key={card.label} style={{ padding: '16px 18px', background: darkMode ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', border: `1px solid ${card.color}30`, borderRadius: '12px' }}>
                          <div style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: '6px' }}>{card.label}</div>
                          <div style={{ fontSize: '18px', fontWeight: '800', color: card.color }}>{card.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Agent Details Table */}
                    <div style={{ border: `1px solid var(--border-color)`, borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
                      <div style={{ padding: '10px 16px', borderBottom: `1px solid var(--border-color)`, fontSize: '10px', letterSpacing: '0.15em', color: '#00d4ff', background: darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.04)', fontWeight: '700' }}>
                        AGENT DETAILS
                      </div>
                      {[
                        { label: 'Binary Path', value: agentInfo.binary },
                        { label: 'Config Path', value: agentInfo.config },
                        { label: 'Server URL', value: agentInfo.server_url },
                        { label: 'Build Date', value: agentInfo.build_date },
                      ].map((row, i) => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid var(--border-color)20`, background: i % 2 === 0 ? 'transparent' : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{row.label}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: '"JetBrains Mono",monospace' }}>{row.value || '—'}</span>
                        </div>
                      ))}
                    </div>

                    {/* Agent Actions */}
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button onClick={() => fetchAgentInfo()} style={{ ...styles.btn, ...styles.btnSecondary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>↺</span> Refresh
                        </button>
                        <button onClick={handleUpdateAgent} style={{ ...styles.btn, ...styles.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>⬆</span> Update Agent
                        </button>
                        <button onClick={handleUninstallAgent} style={{ ...styles.btn, background: '#ff2d5520', color: '#ff2d55', border: '1px solid #ff2d5540', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}>
                          <span>🗑</span> Uninstall Agent
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {agentInfo?.error_detail && !agentInfo?.error && (
                  <div style={{ padding: '16px 20px', marginBottom: '16px', background: darkMode ? 'rgba(255,192,72,0.06)' : 'rgba(255,192,72,0.04)', border: '1px solid #ffb80040', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px' }}>⚠</span>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#ffb800', marginBottom: '2px' }}>Agent Update Required</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{agentInfo.error_detail}</div>
                    </div>
                  </div>
                )}
                {agentInfo?.error_detail && isAdmin && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={handleUpdateAgent} style={{ ...styles.btn, ...styles.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⬆</span> Update Agent
                    </button>
                  </div>
                )}
                {agentInfo?.error && (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#ff2d55', fontSize: '13px', border: '1px solid #ff2d5530', borderRadius: '12px' }}>
                    Error: {agentInfo.error}
                  </div>
                )}
                {!agentInfoLoading && !agentInfo && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Agent is offline or not responding.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

        </div> {/* end page-content */}
      </div> {/* end main-content-area */}

      {/* Bulk Action Progress Modal */}
      {showBulkModal && bulkProgress.length > 0 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: `1px solid var(--border-color)`, width: '100%', maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid var(--border-color)`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: '700', fontSize: '15px' }}>Bulk Action Progress</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {bulkProgress.filter(p=>p.status==='done').length}/{bulkProgress.length} done
                  {bulkProgress.some(p=>p.status==='error') && ` · ${bulkProgress.filter(p=>p.status==='error').length} error`}
                </span>
                {bulkActionLoading && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffb800', animation: 'pulse 1s infinite' }} />}
              </div>
              <button onClick={() => setShowBulkModal(false)} style={{ ...styles.btn, padding: '4px 12px', fontSize: '13px', background: 'var(--bg-card-hover)', border: `1px solid var(--border-color)` }}>
                {bulkActionLoading ? 'Hide (running in background)' : 'Close'}
              </button>
            </div>
            {/* Progress list */}
            <div style={{ overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {bulkProgress.map(p => (
                <div key={p.id} style={{ background: darkMode ? '#1a1a1a' : '#f0f0f0', borderRadius: '8px', padding: '12px 14px', border: `1px solid var(--border-color)` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                        background: p.status === 'done' ? '#00ff88' : p.status === 'error' ? '#ff2d55' : p.status === 'running' ? '#ffb800' : 'var(--border-color)',
                        boxShadow: p.status === 'running' ? '0 0 6px #ffb80080' : p.status === 'done' ? '0 0 4px #00ff8860' : 'none',
                        animation: p.status === 'running' ? 'pulse 1s infinite' : 'none',
                      }} />
                      <span style={{ fontWeight: '600', fontSize: '13px' }}>{p.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>{p.host}</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em',
                      color: p.status === 'done' ? '#00ff88' : p.status === 'error' ? '#ff2d55' : p.status === 'running' ? '#ffb800' : 'var(--text-muted)',
                    }}>{p.status}</span>
                  </div>
                  <div style={{ height: '5px', borderRadius: '3px', background: darkMode ? '#1e1e3a' : '#d0d0d0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '3px',
                      width: p.status === 'pending' ? '0%' : p.status === 'running' ? '60%' : '100%',
                      background: p.status === 'done' ? 'linear-gradient(90deg,#00ff88,#00ff88)' : p.status === 'error' ? '#ff2d55' : 'linear-gradient(90deg,#ffb800,#ffb800)',
                      transition: p.status !== 'running' ? 'width 0.5s ease' : 'none',
                      backgroundSize: p.status === 'running' ? '200% 100%' : '100% 100%',
                      animation: p.status === 'running' ? 'shimmer 1.5s linear infinite' : 'none',
                    }} />
                  </div>
                  {p.output && p.status !== 'pending' && (
                    <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto', background: darkMode ? '#020617' : '#f0f0f0', borderRadius: '4px', padding: '6px 8px', lineHeight: 1.5 }}>
                      {p.output.length > 800 ? p.output.slice(0, 800) + '\n…' : p.output}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Footer */}
            {!bulkActionLoading && (
              <div style={{ padding: '12px 20px', borderTop: `1px solid var(--border-color)`, display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
                <button onClick={() => { setBulkProgress([]); setShowBulkModal(false); }} style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '13px' }}>Clear & Close</button>
                <button onClick={() => setShowBulkModal(false)} style={{ ...styles.btn, ...styles.btnPrimary, fontSize: '13px' }}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showToken && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: `1px solid var(--border-color)`, zIndex: 1001, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Deploy Agent on {showToken.host}</h3>
          <div style={{ fontSize: '13px', color: '#a0a0a0', marginBottom: '8px' }}>Run this on the target server as root or with sudo:</div>
          <div style={{ background: '#1a1a1a', color: '#00ff88', padding: '12px', borderRadius: '6px', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', wordBreak: 'break-all', marginBottom: '8px' }}>
            {showToken.installCmd || `curl -fsSL "..." | sudo sh`}
          </div>
          {showToken.installCmd && (
            <button onClick={() => copyToClipboard(showToken.installCmd, 'token')}
              style={{ width: '100%', padding: '10px 16px', marginBottom: '10px', background: copiedId === 'token' ? 'rgba(0,217,126,0.25)' : 'rgba(0,150,255,0.15)', border: `1px solid ${copiedId === 'token' ? 'rgba(0,217,126,0.5)' : 'rgba(0,150,255,0.4)'}`, color: copiedId === 'token' ? '#00ff88' : '#60a5fa', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease' }}>
              {copiedId === 'token' ? '✓ Copied to Clipboard!' : '📋 Copy Command'}
            </button>
          )}
          <button onClick={() => setShowToken(null)} style={{ ...styles.btn, ...styles.btnPrimary, width: '100%' }}>Got it</button>
        </div>
      )}

      {showWizard && (() => {
        const steps = ['Choose OS', 'Host Details', 'Copy Command', 'Connection'];
        const osOptions = [
          { id: 'linux', label: 'Linux', icon: '🐧', desc: 'Ubuntu, Debian, CentOS, RHEL, Fedora...' },
          { id: 'freebsd', label: 'FreeBSD', icon: '😈', desc: 'FreeBSD / TrueNAS (coming soon)', disabled: true },
          { id: 'windows', label: 'Windows', icon: '🪟', desc: 'Windows Server 2016, 2019, 2022, Windows 10/11' },
        ];
        return (
          <div style={styles.modal} onClick={closeWizard}>
            <ResizableModal style={{ ...styles.modalContent, maxWidth: '560px', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, #000, #131325)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: '700', color: '#fff' }}>Add New Host</div>
                  <div style={{ fontSize: '12px', color: '#a0a0a0', marginTop: '2px' }}>Step {wizardStep} of {steps.length} — {steps[wizardStep - 1]}</div>
                </div>
                <button onClick={closeWizard} style={{ background: 'none', border: 'none', color: '#a0a0a0', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              {/* Progress bar */}
              <div style={{ display: 'flex', background: 'rgba(15,23,42,0.6)', borderBottom: `1px solid var(--border-color)` }}>
                {steps.map((s, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', fontSize: '11px', fontWeight: i + 1 <= wizardStep ? '700' : '400', color: i + 1 < wizardStep ? 'var(--color-success)' : i + 1 === wizardStep ? '#60a5fa' : 'var(--text-muted)', borderBottom: i + 1 === wizardStep ? '2px solid #60a5fa' : i + 1 < wizardStep ? `2px solid var(--color-success)` : '2px solid transparent', transition: 'all 0.2s' }}>
                    <div style={{ fontSize: '15px', marginBottom: '1px' }}>{i + 1 < wizardStep ? '✓' : i + 1}</div>
                    {s}
                  </div>
                ))}
              </div>
              {/* Body */}
              <div style={{ padding: '28px 28px 24px', background: 'var(--bg-card)' }}>
                {/* Step 1: Choose OS */}
                {wizardStep === 1 && (
                  <div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>Select the operating system of the host you want to add.</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {osOptions.map(os => (
                        <div key={os.id} onClick={() => !os.disabled && setWizardOS(os.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 18px', borderRadius: '8px', border: `2px solid ${wizardOS === os.id ? '#00d4ff' : 'var(--border-color)'}`, background: wizardOS === os.id ? 'rgba(0,212,255,0.08)' : 'rgba(22,22,42,0.4)', cursor: os.disabled ? 'not-allowed' : 'pointer', opacity: os.disabled ? 0.45 : 1, transition: 'all 0.15s' }}>
                          <div style={{ fontSize: '32px' }}>{os.icon}</div>
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)' }}>{os.label}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{os.desc}</div>
                          </div>
                          <div style={{ marginLeft: 'auto' }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${wizardOS === os.id ? '#00d4ff' : 'var(--border-color)'}`, background: wizardOS === os.id ? '#00d4ff' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {wizardOS === os.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => setWizardStep(2)} style={{ ...styles.btn, ...styles.btnPrimary }}>Next →</button>
                    </div>
                  </div>
                )}
                {/* Step 2: Host Details */}
                {wizardStep === 2 && (
                  <div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>Enter the IP address of the server. Hostname and OS will be detected automatically when the agent connects.</div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={styles.label}>IP Address</label>
                      <input autoFocus type="text" value={wizardHost} onChange={e => setWizardHost(e.target.value)}
                        placeholder="e.g. 192.168.1.201"
                        style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }}
                        onKeyDown={e => e.key === 'Enter' && wizardHost && document.querySelector('[data-wizard-next]')?.click()} />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={styles.label}>Friendly Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional — auto-detected from hostname)</span></label>
                      <input type="text" value={wizardName} onChange={e => setWizardName(e.target.value)}
                        placeholder="e.g. web-server-01"
                        style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }}
                        onKeyDown={e => e.key === 'Enter' && wizardHost && document.querySelector('[data-wizard-next]')?.click()} />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={styles.label}>Group <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                      <input type="text" value={wizardGroup} onChange={e => setWizardGroup(e.target.value)}
                        placeholder="e.g. production"
                        style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <button onClick={() => setWizardStep(1)} style={{ ...styles.btn, ...styles.btnSecondary }}>← Back</button>
                      <button onClick={async () => {
                        if (!wizardHost) return;
                        let sid = wizardServerId;
                        if (!sid) {
                          try {
                            const r = await fetch('/api/servers', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ name: wizardName || wizardHost, host: wizardHost, group: wizardGroup || 'manual' }) });
                            const d = await r.json();
                            sid = d.server?.id || '';
                            setWizardServerId(sid);
                            wizardServerIdRef.current = sid;
                            // NOTE: do NOT add sid to wizardPreServersRef so polling can detect it
                          } catch {}
                        }
                        if (sid) fetchWizardInstallCmd(sid, wizardOS);
                        setWizardStep(3);
                      }} data-wizard-next disabled={!wizardHost} style={{ ...styles.btn, ...styles.btnPrimary, opacity: wizardHost ? 1 : 0.5 }}>Next →</button>
                    </div>
                  </div>
                )}
                {/* Step 3: Copy Command */}
                {wizardStep === 3 && (() => {
                  if (!wizardInstallCmd && !wizardInstallCmdLoading) {
                    if (wizardServerId) fetchWizardInstallCmd(wizardServerId, wizardOS);
                  }
                  return (
                    <div>
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        {wizardOS === 'windows'
                          ? <>Run this command on <strong style={{ color: 'var(--text-primary)' }}>{wizardName || 'your server'}</strong> in <strong style={{ color: '#60a5fa' }}>PowerShell as Administrator</strong>:</>
                          : <>Run this command on <strong style={{ color: 'var(--text-primary)' }}>{wizardName || 'your server'}</strong> as root or with sudo:</>}
                      </div>
                      {wizardOS === 'windows' && (
                        <div style={{ marginBottom: '10px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', fontSize: '12px', color: '#60a5fa' }}>
                          ⊞ PowerShell — Run as Administrator (right-click → Run as Administrator)
                        </div>
                      )}
                      <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: '8px', padding: '14px 16px', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#00ff88', wordBreak: 'break-all', border: '1px solid rgba(0,217,126,0.2)', minHeight: '52px' }}>
                        {wizardInstallCmdLoading ? <span style={{ color: '#60a5fa' }}>Loading...</span> : wizardInstallCmd}
                      </div>
                      {wizardInstallCmd && (
                        <button onClick={() => copyToClipboard(wizardInstallCmd, 'wizard')}
                          style={{ marginTop: '10px', width: '100%', padding: '10px 16px', background: copiedId === 'wizard' ? 'rgba(0,217,126,0.25)' : 'rgba(0,150,255,0.15)', border: `1px solid ${copiedId === 'wizard' ? 'rgba(0,217,126,0.5)' : 'rgba(0,150,255,0.4)'}`, color: copiedId === 'wizard' ? '#00ff88' : '#60a5fa', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease' }}>
                          {copiedId === 'wizard' ? '✓ Copied to Clipboard!' : '📋 Copy Command'}
                        </button>
                      )}
                      <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {wizardOS === 'windows'
                          ? 'The script will download the agent binary and register it as a Windows Service (visible in services.msc).'
                          : 'The script will download the agent binary, configure it, and start it as a systemd service.'}
                      </div>
                      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={() => { setWizardStep(2); setWizardInstallCmd(''); }} style={{ ...styles.btn, ...styles.btnSecondary }}>← Back</button>
                        <button onClick={() => { setWizardStep(4); startWizardPolling(); }} style={{ ...styles.btn, ...styles.btnPrimary }}>Next → Wait for Connection</button>
                      </div>
                    </div>
                  );
                })()}
                {/* Step 4: Connection */}
                {wizardStep === 4 && (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    {!wizardConnected ? (
                      <>
                        <div style={{ fontSize: '48px', marginBottom: '12px', animation: 'spin 2s linear infinite' }}>⟳</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>Waiting for connection...</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Run the command from the previous step on <strong style={{ color: 'var(--text-primary)' }}>{wizardName || 'your server'}</strong>. The dashboard will update automatically.</div>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '24px' }}>
                          {[0,1,2].map(i => (
                            <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00d4ff', animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }} />
                          ))}
                        </div>
                        <button onClick={() => setWizardStep(3)} style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '12px' }}>← Back to command</button>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '52px', marginBottom: '12px' }}>✓</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-success)', marginBottom: '8px' }}>Connected!</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{wizardNewServer?.name || wizardName}</strong> is now online
                        </div>
                        {wizardNewServer?.host && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>{wizardNewServer.host}</div>}
                        <button onClick={() => { closeWizard(); fetchServers(); setNavSection('servers'); }}
                          style={{ ...styles.btn, ...styles.btnPrimary }}>Go to Dashboard</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </ResizableModal>
          </div>
        );
      })()}

      {showScan && (
        <div style={styles.modal} onClick={() => setShowScan(false)}>
          <ResizableModal style={{ ...styles.modalContent, maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0 }}>Network Scan</h2>
              <button onClick={() => setShowScan(false)} style={styles.closeBtn}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formRow}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Subnet (CIDR)</label>
                  <input 
                    type="text" 
                    value={scanSubnet}
                    onChange={e => setScanSubnet(e.target.value)}
                    placeholder="192.168.1.0/24"
                    style={styles.input}
                  />
                </div>
                <button onClick={startScan} style={{ ...styles.btn, ...styles.btnPrimary }}>Scan</button>
              </div>
              {scanStatus && <div style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>{scanStatus}</div>}
              {foundServers.length > 0 && (
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '12px' }}>Found {foundServers.length} servers:</div>
                  {foundServers.map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-card-hover)', borderRadius: '6px', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: '500' }}>{String(s.host || '')}</div>
                        {s.hostname && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{String(s.hostname)}</div>}
                      </div>
                      <button onClick={() => addScannedServer(s)} style={{ ...styles.btn, ...styles.btnPrimary, padding: '6px 12px', fontSize: '12px' }}>Add</button>
                    </div>
                  ))}
                  <button onClick={addAllScanned} style={{ ...styles.btn, ...styles.btnSuccess, width: '100%', marginTop: '12px' }}>Add All</button>
                </div>
              )}
            </div>
          </ResizableModal>
        </div>
      )}

      {/* Reboot Confirmation Modal */}
      {showRebootConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: `1px solid var(--border-color)`, width: '100%', maxWidth: '460px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid var(--border-color)`, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ff2d5520', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>↺</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '15px' }}>Odaberi servere za reboot</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Odznači servere koje ne želiš restartovati</div>
              </div>
              {/* Select all / none */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setRebootSelected(new Set(rebootTargets.map(s => s.id)))}
                  style={{ fontSize: '11px', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Sve</button>
                <span style={{ color: 'var(--border-color)' }}>|</span>
                <button onClick={() => setRebootSelected(new Set())}
                  style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Ništa</button>
              </div>
            </div>
            {/* Server list with checkboxes */}
            <div style={{ padding: '8px 24px', maxHeight: '280px', overflowY: 'auto' }}>
              {rebootTargets.map(s => {
                const checked = rebootSelected.has(s.id);
                return (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: `1px solid var(--border-color)20`, cursor: 'pointer' }}>
                    <input type="checkbox" checked={checked}
                      onChange={() => setRebootSelected(prev => {
                        const next = new Set(prev);
                        next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                        return next;
                      })}
                      style={{ width: '16px', height: '16px', accentColor: '#ff2d55', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: checked ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>{s.host}</div>
                    </div>
                    <span style={{ fontSize: '11px', background: checked ? '#ff2d5520' : 'var(--bg-card-hover)', color: checked ? '#ff2d55' : 'var(--text-muted)', padding: '2px 8px', borderRadius: '8px', fontWeight: '600' }}>
                      {checked ? 'reboot' : 'preskoči'}
                    </span>
                  </label>
                );
              })}
            </div>
            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid var(--border-color)`, display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{rebootSelected.size} od {rebootTargets.length} selektovano</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowRebootConfirm(false)} style={{ ...styles.btn, ...styles.btnSecondary, padding: '8px 20px' }}>Otkaži</button>
                <button onClick={executeReboot} disabled={rebootSelected.size === 0}
                  style={{ background: '#ff2d55', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontWeight: '600', cursor: rebootSelected.size === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: rebootSelected.size === 0 ? 0.4 : 1 }}>
                  ↺ Rebootuj ({rebootSelected.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Donation modal */}
      {showDonationModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: darkMode ? '#1e1e3a' : '#fff', borderRadius: '20px', padding: '36px 40px', maxWidth: '420px', width: '90%', boxShadow: '0 24px 80px rgba(0,0,0,0.4)', textAlign: 'center', border: `1px solid ${darkMode ? '#444444' : '#d0d0d0'}` }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>☕</div>
            <div style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px', background: 'linear-gradient(135deg, #00ff88, #71717A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: 'none' }}>Enjoying ServerCTL?</div>
            <div style={{ fontSize: '14px', color: darkMode ? '#a0a0a0' : '#64748b', lineHeight: 1.7, marginBottom: '28px' }}>
              ServerCTL is free and open-source. If it saves you time and makes your life easier, consider buying me a coffee — it helps keep the project alive and growing.
            </div>
            <a href="https://buymeacoffee.com/vilic355" target="_blank" rel="noreferrer"
              style={{ display: 'block', background: '#FFDD00', color: '#000', fontWeight: '800', fontSize: '15px', padding: '13px 24px', borderRadius: '8px', textDecoration: 'none', marginBottom: '12px', transition: 'transform 0.15s, filter 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
              onMouseLeave={e => e.currentTarget.style.filter = ''}>
              ☕ Buy me a coffee
            </a>
            <button onClick={() => { localStorage.setItem('serverctl_donated', 'true'); setShowDonationModal(false); }}
              style={{ display: 'block', width: '100%', background: darkMode ? '#1a1a1a' : '#f0f0f0', color: darkMode ? '#a0a0a0' : '#55556e', border: `1px solid ${darkMode ? '#444444' : '#d0d0d0'}`, borderRadius: '8px', padding: '11px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginBottom: '8px' }}>
              I've donated — don't show again
            </button>
            <button onClick={() => setShowDonationModal(false)}
              style={{ background: 'none', border: 'none', color: darkMode ? '#55556e' : '#a0a0a0', fontSize: '12px', cursor: 'pointer', padding: '4px' }}>
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Global Task Progress Panel */}
      {globalTasks.length > 0 && (
        <div style={{ position: 'fixed', bottom: '24px', left: '224px', zIndex: 9998, width: '360px', background: darkMode ? '#0f1a24' : '#fff', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, background: darkMode ? '#1a1a1a' : '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {globalTasks.some(t => t.status === 'running') && (
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff88', animation: 'pulse 1s infinite', flexShrink: 0 }} />
              )}
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#00d4ff', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Tasks {globalTasks.filter(t => t.status === 'running').length > 0 && `(${globalTasks.filter(t => t.status === 'running').length} running)`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {globalTasks.some(t => t.status !== 'running') && (
                <button onClick={clearFinishedTasks} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '10px', padding: '2px 6px' }}>Clear</button>
              )}
              <button onClick={() => setGlobalTasks([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
            </div>
          </div>
          {/* Task list */}
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {globalTasks.slice().reverse().map(task => {
              const elapsed = Math.round((Date.now() - task.startTime) / 1000);
              const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
              return (
                <div key={task.id} style={{ display: 'flex', gap: '10px', padding: '10px 14px', borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)20' : '#d0d0d020'}`, alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0, marginTop: '2px' }}>
                    {task.status === 'running' && <div style={{ width: '14px', height: '14px', border: '2px solid #00ff8840', borderTopColor: '#00ff88', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                    {task.status === 'done' && <span style={{ color: '#00ff88', fontSize: '14px' }}>✓</span>}
                    {task.status === 'error' && <span style={{ color: '#ff2d55', fontSize: '14px' }}>✗</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{task.label}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{elapsedStr}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: task.status === 'running' ? '6px' : '0' }}>{task.server}</div>
                    {task.status === 'running' && (
                      <div style={{ height: '3px', background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#00d4ff', borderRadius: '2px', animation: 'progressIndeterminate 1.5s ease-in-out infinite', width: '40%' }} />
                      </div>
                    )}
                    {task.output && task.status !== 'running' && (
                      <div style={{ fontSize: '10px', color: task.status === 'error' ? '#ff2d55' : '#00ff88', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.output}</div>
                    )}
                  </div>
                  <button onClick={() => removeTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: 0, flexShrink: 0, opacity: 0.5 }}>×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '380px' }}>
          {toasts.map(t => (
            <div key={t.id} style={{ background: darkMode ? '#1e1e3a' : '#fff', border: `1px solid ${t.type === 'error' ? '#ff2d5540' : '#00ff8840'}`, borderLeft: `4px solid ${t.type === 'error' ? '#ff2d55' : '#00ff88'}`, borderRadius: '8px', padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', gap: '12px', alignItems: 'flex-start', animation: 'slideIn 0.2s ease' }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{t.type === 'error' ? '⚠️' : '✅'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: t.type === 'error' ? '#ff2d55' : '#00ff88', marginBottom: '3px' }}>{t.title}</div>
                <div style={{ fontSize: '12px', color: darkMode ? '#a0a0a0' : '#64748b', lineHeight: 1.4 }}>{t.message}</div>
              </div>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: darkMode ? '#55556e' : '#a0a0a0', fontSize: '16px', padding: 0, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default Dashboard;
