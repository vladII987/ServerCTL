import React, { useState, useEffect, useRef, useMemo } from 'react';

const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_HOST = `${WS_PROTOCOL}//${window.location.host}`;

const colors = {
  dark: {
    bg: '#16232E',
    card: '#1a2d3a',
    cardHover: '#1f3748',
    text: '#c8d8de',
    textMuted: '#5d8a9a',
    border: '#2a5063',
    input: '#0f1e28',
    inputBorder: '#467885',
    primary: '#A8987C',
    primaryHover: '#bfaa8c',
    success: '#3dd68c',
    danger: '#f06060',
    warning: '#e8a838',
    purple: '#8b7cf6',
    green: '#3dd68c',
    red: '#f06060',
    orange: '#e8773a',
    amber: '#e8a838',
    yellow: '#d4b840',
    lime: '#7ac840',
    emerald: '#2ec880',
    teal: '#2ab8a8',
    cyan: '#20b0cc',
    sky: '#30a8e0',
    blue: '#4888e8',
    indigo: '#6068e8',
    violet: '#8b7cf6',
    fuchsia: '#c040d8',
    pink: '#d840a0',
    rose: '#e84068',
  },
  light: {
    bg: '#eef2f4',
    card: '#ffffff',
    cardHover: '#e8eef2',
    text: '#16232E',
    textMuted: '#467885',
    border: '#c0d4da',
    input: '#ffffff',
    inputBorder: '#A8987C',
    primary: '#25515E',
    primaryHover: '#16232E',
    success: '#22a86a',
    danger: '#d04040',
    warning: '#c08020',
    purple: '#7060d8',
    green: '#22a86a',
    red: '#d04040',
    orange: '#c06030',
    amber: '#c08020',
    yellow: '#b09000',
    lime: '#608020',
    emerald: '#18a060',
    teal: '#18908a',
    cyan: '#1888a8',
    sky: '#2080c0',
    blue: '#2868c8',
    indigo: '#4050b8',
    violet: '#7060d8',
    fuchsia: '#a030b0',
    pink: '#b02888',
    rose: '#c03058',
  }
};

// ─── Login page ────────────────────────────────────────────────
const LoginPage = ({ onLogin, darkMode, toggleDark }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const c = darkMode ? colors.dark : colors.light;

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
    <div style={{ minHeight: '100vh', background: darkMode ? '#16232E' : '#eef2f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Hack", "Courier New", monospace', color: c.text, position: 'relative', overflow: 'hidden' }}>
      <style>{`
        * { font-family: 'Hack', 'Courier New', monospace !important; }
        @keyframes loginGrid { 0%,100% { opacity: 0.04; } 50% { opacity: 0.08; } }
        @keyframes loginScan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
        @keyframes loginGlow { 0%,100% { box-shadow: 0 0 20px rgba(168,152,124,0.15), 0 0 60px rgba(70,120,133,0.1); } 50% { box-shadow: 0 0 30px rgba(168,152,124,0.25), 0 0 80px rgba(70,120,133,0.15); } }
        .login-input:focus { border-color: #A8987C !important; box-shadow: 0 0 0 1px #A8987C40, 0 0 12px #A8987C20 !important; outline: none; }
        .login-btn:hover:not(:disabled) { background: #bfaa8c !important; box-shadow: 0 0 20px #A8987C40 !important; }
      `}</style>
      {/* Grid background */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${darkMode ? 'rgba(70,120,133,0.07)' : 'rgba(37,81,94,0.06)'} 1px, transparent 1px), linear-gradient(90deg, ${darkMode ? 'rgba(70,120,133,0.07)' : 'rgba(37,81,94,0.06)'} 1px, transparent 1px)`, backgroundSize: '40px 40px', animation: 'loginGrid 4s ease-in-out infinite' }} />
      {/* Scan line */}
      {darkMode && <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, rgba(168,152,124,0.15), transparent)', animation: 'loginScan 8s linear infinite', pointerEvents: 'none' }} />}

      <div style={{ width: '100%', maxWidth: '400px', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.4em', color: '#467885', marginBottom: '8px', textTransform: 'uppercase' }}>◈ SYSTEM ONLINE ◈</div>
          <div style={{ fontSize: '38px', fontWeight: '900', letterSpacing: '0.12em', color: '#A8987C', textShadow: darkMode ? '0 0 30px rgba(168,152,124,0.4)' : 'none', fontFamily: '"Hack", "Courier New", monospace' }}>SERVERCTL</div>
          <div style={{ fontSize: '11px', letterSpacing: '0.25em', color: '#467885', marginTop: '6px', textTransform: 'uppercase' }}>Infrastructure Control Interface</div>
        </div>

        {/* Card */}
        <div style={{ background: darkMode ? 'rgba(26,45,58,0.92)' : 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', border: `1px solid ${darkMode ? '#2a5063' : '#c0d4da'}`, padding: '32px', clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))', animation: darkMode ? 'loginGlow 3s ease-in-out infinite' : 'none' }}>
          {/* Corner accents */}
          <div style={{ position: 'absolute', top: 0, right: 0, width: '16px', height: '16px', borderTop: `2px solid #A8987C`, borderRight: `2px solid #A8987C` }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '16px', height: '16px', borderBottom: `2px solid #A8987C`, borderLeft: `2px solid #A8987C` }} />

          <div style={{ fontSize: '11px', letterSpacing: '0.2em', color: '#467885', textTransform: 'uppercase', marginBottom: '24px' }}>// Authentication Required</div>

          <form onSubmit={submit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '6px', color: '#467885', letterSpacing: '0.15em', textTransform: 'uppercase' }}>User ID</label>
              <input value={username} onChange={e => setUsername(e.target.value)} autoFocus required className="login-input"
                style={{ width: '100%', padding: '10px 14px', border: `1px solid ${darkMode ? '#2a5063' : '#c0d4da'}`, background: darkMode ? '#0f1e28' : '#f5f8fa', color: c.text, fontSize: '14px', boxSizing: 'border-box', fontFamily: '"Hack", "Courier New", monospace', transition: 'all 0.2s', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '6px', color: '#467885', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Access Key</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="login-input"
                style={{ width: '100%', padding: '10px 14px', border: `1px solid ${darkMode ? '#2a5063' : '#c0d4da'}`, background: darkMode ? '#0f1e28' : '#f5f8fa', color: c.text, fontSize: '14px', boxSizing: 'border-box', fontFamily: '"Hack", "Courier New", monospace', transition: 'all 0.2s', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }} />
            </div>
            {error && <div style={{ border: '1px solid #f0606040', background: '#f0606012', color: '#f06060', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', fontFamily: '"Hack", "Courier New", monospace', letterSpacing: '0.05em' }}>⚠ {error}</div>}
            <button type="submit" disabled={loading} className="login-btn"
              style={{ width: '100%', padding: '12px', border: `1px solid #A8987C`, background: '#A8987C', color: '#16232E', fontSize: '13px', fontWeight: '800', cursor: 'pointer', letterSpacing: '0.25em', textTransform: 'uppercase', fontFamily: '"Hack", "Courier New", monospace', clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))', transition: 'all 0.2s' }}>
              {loading ? '[ AUTHENTICATING... ]' : '[ INITIALIZE ACCESS ]'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button onClick={toggleDark} style={{ background: 'none', border: 'none', color: '#467885', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: '"Hack", "Courier New", monospace' }}>{darkMode ? '◑ Light Interface' : '◐ Dark Interface'}</button>
        </div>
      </div>
    </div>
  );
};

// ─── Donut chart ───────────────────────────────────────────────
const DonutChart = ({ data, c }) => {
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
        <text x="70" y="66" textAnchor="middle" fontSize="20" fontWeight="800" fill={c.text}>{total}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="10" fill={c.textMuted}>servers</text>
      </svg>
      <div style={{ fontSize: '13px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: d.color, flexShrink: 0 }} />
            <span style={{ color: c.text }}>{d.label}</span>
            <span style={{ color: c.textMuted, marginLeft: 'auto', paddingLeft: '12px' }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

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
          background: '#0d1117',
          foreground: '#c9d1d9',
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

  return <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#0d1117' }} />;
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
  const [darkMode, setDarkMode] = useState(true);
  React.useEffect(() => {
    const bg = darkMode ? '#16232E' : '#eef2f4';
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
    document.body.style.margin = '0';
    document.documentElement.style.setProperty('--scrollbar-track', darkMode ? '#0f1e28' : '#e0e8ec');
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [serverQuickFilter, setServerQuickFilter] = useState('all');
  const [selectedServers, setSelectedServers] = useState([]);
  const [bulkActionOutput, setBulkActionOutput] = useState('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState([]); // [{id, name, host, status, output}]
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

  const copyToClipboard = (text) => {
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
  const [navSection, setNavSection] = useState('servers');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeOutput, setUpgradeOutput] = useState('');
  // Shell section state
  const [shellServer, setShellServer] = useState(null);
  const [shellWs, setShellWs] = useState(null);
  const [shellConnected, setShellConnected] = useState(false);
  const [shellUsername, setShellUsername] = useState('administrator');
  const [shellPassword, setShellPassword] = useState('');
  const [shellAuthMethod, setShellAuthMethod] = useState('password');
  const [shellKeyContent, setShellKeyContent] = useState('');
  const [shellSessionKey, setShellSessionKey] = useState(0);
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
  // Branding
  const [customLogo, setCustomLogo] = useState(() => localStorage.getItem('serverctl_logo') || '');
  const [customTabTitle, setCustomTabTitle] = useState(() => localStorage.getItem('serverctl_tab_title') || 'ServerCTL');

  const c = darkMode ? colors.dark : colors.light;
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
    const palette = ['#3b82f6','#8b5cf6','#22c55e','#f59e0b','#ef4444','#06b6d4','#f97316'];
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

  useEffect(() => { fetchServers(); fetchHostStatus(); }, []);
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

  // ── Shell section (nav sidebar) ──
  const connectShellSSH = () => {
    setShellConnected(false);
    setShellSessionKey(k => k + 1); // force XTerminal remount
  };

  const disconnectShellSSH = () => {
    setShellConnected(false);
    setShellSessionKey(0);
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
    const cmdLabels = { system_info: 'System Info', disk_usage: 'Disk Usage', memory: 'Memory', cpu_info: 'CPU Info', netstat: 'Network', update_agent: 'Update Agent', uninstall_agent: 'Uninstall Agent' };
    const taskId = addTask(selectedServer.name, command, cmdLabels[command] || command);
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
      updateTask(taskId, { status: 'done', output: output.substring(0, 200) });
    } catch (err) {
      setActionOutput('Error: ' + err.message);
      updateTask(taskId, { status: 'error', output: err.message });
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
      const summary = lines.find(l => l.includes('Fetched') || l.includes('up to date') || l.includes('Reading package'));
      let packages = [];
      try {
        const pkgRes = await agentAction('upgradable_packages');
        packages = (pkgRes.output || '').split('\n')
          .filter(l => l && !l.startsWith('Listing') && l.includes('/'))
          .map(l => {
            const parts = l.split(' ');
            const name = parts[0]?.split('/')[0] || '';
            const version = parts[1] || '';
            return { name, version };
          });
      } catch {}
      setUpdatesData({ fetched: fetched.length, summary, packages, success: updateRes.returncode === 0 });
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
      const packages = (res.output || '').split('\n')
        .filter(l => l && !l.startsWith('Listing') && l.includes('/'))
        .map(l => l.split('/')[0]);
      await fetch(`/api/servers/${selectedServer.id}/pending-updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ count: packages.length, packages }),
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
        const data = await res.json();
        setBulkProgress(prev => prev.map(p => p.id === item.id ? { ...p, status: data.status === 'completed' ? 'done' : 'error', output: data.output || '' } : p));
        if (data.status === 'completed') {
          const remaining = await refreshServerUpdates(item.id);
          if (remaining === 0) {
            addToast('success', `${item.name} updated`, 'No more pending updates');
          }
        } else {
          const isSSH = !res.ok && String(data.detail || '').toLowerCase().match(/unreachable|connection|timeout|ssh/);
          if (isSSH) addToast('error', `SSH failed: ${item.name}`, `${item.host} — update must be done manually`);
        }
      } catch (err) {
        setBulkProgress(prev => prev.map(p => p.id === item.id ? { ...p, status: 'error', output: err.message } : p));
        addToast('error', `SSH failed: ${item.name}`, `${item.host} — update must be done manually`);
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
      background: c.bg,
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      color: c.text,
      transition: 'all 0.3s',
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
      clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
      border: `1px solid ${c.border}`,
      fontSize: '14px',
      background: c.card,
      color: c.text,
      width: '250px',
      outline: 'none',
    },
    btn: {
      padding: '8px 16px',
      border: 'none',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.15s',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      letterSpacing: '0.04em',
      clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
    },
    btnPrimary: {
      background: '#A8987C',
      color: '#16232E',
      border: '1px solid #A8987C',
    },
    btnSecondary: {
      background: 'transparent',
      color: c.text,
      border: `1px solid ${c.border}`,
    },
    btnSuccess: {
      background: 'transparent',
      color: '#3dd68c',
      border: '1px solid #3dd68c60',
    },
    btnDanger: {
      background: 'transparent',
      color: '#f06060',
      border: '1px solid #f0606050',
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '24px',
    },
    statCard: (color) => ({
      background: darkMode ? 'rgba(26,45,58,0.88)' : 'rgba(255,255,255,0.88)',
      padding: '20px',
      border: `1px solid ${darkMode ? '#2a5063' : '#c0d4da'}`,
      borderLeft: `3px solid ${color}`,
      clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
      boxShadow: darkMode ? `0 0 12px ${color}18` : 'none',
    }),
    statLabel: {
      fontSize: '13px',
      color: c.textMuted,
      marginBottom: '8px',
      fontWeight: '500',
    },
    statValue: {
      fontSize: '32px',
      fontWeight: '700',
    },
    statSub: {
      fontSize: '12px',
      color: c.textMuted,
      marginTop: '4px',
    },
    card: {
      background: darkMode ? 'rgba(26,45,58,0.88)' : 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(10px)',
      clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
      boxShadow: darkMode ? '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(70,120,133,0.1)' : '0 4px 16px rgba(0,0,0,0.08)',
      marginBottom: '24px',
      border: `1px solid ${darkMode ? '#2a5063' : '#c0d4da'}`,
      overflow: 'hidden',
    },
    cardHeader: {
      padding: '16px 20px',
      borderBottom: `1px solid ${c.border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: '13px',
      fontWeight: '700',
      margin: 0,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: '#A8987C',
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
      padding: '12px 16px',
      fontSize: '12px',
      fontWeight: '600',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      background: c.bg,
      borderBottom: `1px solid ${c.border}`,
    },
    td: {
      padding: '14px 16px',
      fontSize: '14px',
      borderBottom: `1px solid ${c.border}`,
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
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '500',
      background: online ? '#dcfce7' : '#fee2e2',
      color: online ? '#166534' : '#991b1b',
    }),
    statusDot: (online) => ({
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: online ? '#22c55e' : '#ef4444',
    }),
    groupBadge: {
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      background: c.cardHover,
      color: c.textMuted,
    },
    actionBtns: {
      display: 'flex',
      gap: '6px',
    },
    iconBtn: {
      padding: '6px 10px',
      borderRadius: '6px',
      border: 'none',
      background: 'transparent',
      color: c.textMuted,
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'all 0.2s',
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    modalContent: {
      background: c.card,
      borderRadius: '4px',
      width: '90%',
      maxWidth: '960px',
      minWidth: '480px',
      minHeight: '300px',
      maxHeight: '92vh',
      overflow: 'auto',
      border: `1px solid ${c.border}`,
      resize: 'both',
      display: 'flex',
      flexDirection: 'column',
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '20px 24px',
      borderBottom: `1px solid ${c.border}`,
    },
    modalBody: {
      padding: '24px',
    },
    tabs: {
      display: 'flex',
      gap: '0',
      marginBottom: '24px',
      borderBottom: `2px solid ${c.border}`,
    },
    tab: (active, hover) => ({
      padding: '10px 20px',
      border: 'none',
      borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
      marginBottom: '-2px',
      background: hover && !active ? (darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') : 'transparent',
      color: active ? '#3b82f6' : hover ? c.text : c.textMuted,
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: active ? '600' : '500',
      letterSpacing: '0.02em',
      transition: 'color 0.15s, border-color 0.15s, background 0.15s',
      whiteSpace: 'nowrap',
      borderRadius: '6px 6px 0 0',
    }),
    sshTerminal: {
      background: '#0d1117',
      color: '#c9d1d9',
      padding: '16px',
      clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
      fontFamily: '"Hack", "Courier New", monospace',
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
      clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
      border: '1px solid #30363d',
      background: '#0d1117',
      color: '#c9d1d9',
      fontFamily: '"Hack", "Courier New", monospace',
      fontSize: '13px',
      marginTop: '12px',
    },
    closeBtn: {
      background: 'transparent',
      border: 'none',
      color: c.textMuted,
      fontSize: '24px',
      cursor: 'pointer',
      padding: '0',
      lineHeight: 1,
    },
    input: {
      padding: '8px 12px',
      border: `1px solid ${darkMode ? '#2a5063' : '#b8cdd6'}`,
      fontSize: '13px',
      outline: 'none',
      background: darkMode ? '#0f1e28' : '#f0f5f8',
      color: c.text,
      minWidth: '180px',
      clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    },
    label: {
      fontSize: '13px',
      fontWeight: '500',
      color: c.textMuted,
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
      background: c.bg,
      padding: '16px',
      clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
      fontFamily: '"Hack", "Courier New", monospace',
      fontSize: '12px',
      whiteSpace: 'pre-wrap',
      maxHeight: '200px',
      overflow: 'auto',
    },
    empty: {
      textAlign: 'center',
      padding: '40px',
      color: c.textMuted,
    },
  };

  const MetricBar = ({ label, value, color }) => (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', color: c.textMuted }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: '600' }}>{value !== null ? value + '%' : 'N/A'}</span>
      </div>
      <div style={{ height: '8px', borderRadius: '4px', background: c.cardHover, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value || 0}%`, background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  );

  // ── Parsers ──────────────────────────────────────────────────
  const parseDf = (text) => {
    const lines = text.trim().split('\n').filter(Boolean);
    if (!lines[0]?.includes('Filesystem')) return null;
    return lines.slice(1).map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) return null;
      const [fs, size, used, avail, usePct, ...mountParts] = parts;
      const pct = parseInt(usePct) || 0;
      return { fs, size, used, avail, pct, mount: mountParts.join(' ') };
    }).filter(Boolean);
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
  const barTrack = { height: '6px', borderRadius: '3px', background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' };
  const barFill = (pct, color) => ({ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.4s ease' });
  const pctColor = (pct) => pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#3b82f6';
  const badge = (text, color) => ({ display: 'inline-block', background: color + '20', color, padding: '1px 8px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', fontWeight: '700', fontSize: '11px' });

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
            <div key={i} style={{ background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', padding: '12px 16px', border: `1px solid ${c.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: c.text }}>{r.mount}</span>
                  <span style={{ fontSize: '11px', color: c.textMuted, marginLeft: '8px' }}>{r.fs}</span>
                </div>
                <div style={{ fontSize: '12px', color: c.textMuted, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: c.text }}>{r.used} / {r.size}</span>
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
            <div key={i} style={{ background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', padding: '12px 16px', border: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Swap</span>
              <span style={{ fontSize: '12px', color: c.textMuted }}>Not configured</span>
            </div>
          );
          return (
            <div key={i} style={{ background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', padding: '14px 16px', border: `1px solid ${c.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: '700' }}>{r.label === 'Mem' ? 'Memory (RAM)' : 'Swap'}</span>
                <span style={badge(pct + '%', color)}>{pct}%</span>
              </div>
              <div style={barTrack}><div style={barFill(pct, color)} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px', color: c.textMuted }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span>Used: <strong style={{ color: c.text }}>{r.used}</strong></span>
                  {r.buffCache && <span>Cache: <strong style={{ color: c.text }}>{r.buffCache}</strong></span>}
                  {r.available && <span>Free: <strong style={{ color: '#22c55e' }}>{r.available}</strong></span>}
                </div>
                <span>Total: <strong style={{ color: c.text }}>{r.total}</strong></span>
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
        {title && <div style={{ fontSize: '12px', fontWeight: '600', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>{title}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sortedEntries.map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 12px', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', background: i % 2 === 0 ? (darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent' }}>
              <span style={{ fontSize: '13px', color: c.textMuted, flexShrink: 0, marginRight: '16px' }}>{k}</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: c.text, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
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
      <div style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', border: `1px solid ${c.border}`, overflow: 'hidden' }}>
        <div style={{ background: darkMode ? '#0d1820' : '#f0f5f8', padding: '8px 14px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ef4444' }} />
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#f59e0b' }} />
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: '11px', color: c.textMuted, marginLeft: '6px', fontFamily: '"Hack", "Courier New", monospace' }}>output</span>
        </div>
        <pre style={{ margin: 0, padding: '14px 16px', background: darkMode ? '#0d1117' : '#f8fafc', color: darkMode ? '#c9d1d9' : '#1e293b', fontFamily: '"Hack", "Courier New", monospace', fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '320px', overflow: 'auto' }}>{text}</pre>
      </div>
    );
  };

  if (!user) return <LoginPage onLogin={handleLogin} darkMode={darkMode} toggleDark={() => setDarkMode(!darkMode)} />;

  const navItems = [
    { key: 'dashboard',  icon: '⬡',  label: 'Dashboard' },
    { key: 'servers',    icon: '▦',   label: 'Servers' },
    { key: 'networks',   icon: '⬡',   label: 'Networks' },
    { key: 'logs',       icon: '≡',   label: 'Logs' },
    { key: 'shell',      icon: '>_',  label: 'Shell' },
    { key: 'updates',    icon: '↑',   label: 'Updates' },
    { key: 'activity',   icon: '◷',   label: 'Activity' },
    { key: 'schedules',  icon: '⏰',  label: 'Schedules' },
    { key: 'settings',   icon: '⚙',   label: 'Settings' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', color: c.text, fontFamily: '"Hack", "Courier New", monospace', background: darkMode ? '#16232E' : '#eef2f4', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        * { font-family: 'Hack', 'Courier New', monospace !important; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes progressIndeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
        .probe-info-wrap:hover .probe-info-icon { background: #A8987C !important; color: #16232E !important; }
        .probe-info-wrap:hover .probe-tooltip { display: block !important; }
        button:not(:disabled):active { transform: scale(0.96) !important; }
        button:disabled { opacity: 0.35 !important; cursor: not-allowed !important; pointer-events: auto !important; }
        button:not(:disabled) { transition: filter 0.12s, transform 0.1s, box-shadow 0.15s; }
        button:not(:disabled):hover { filter: brightness(1.12); }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: var(--scrollbar-track); }
        ::-webkit-scrollbar-thumb { background: #467885; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #A8987C; }
        input, select, textarea { color-scheme: var(--color-scheme); }
        .fut-card { clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px)); }
        .fut-btn { clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px)); }
      `}} />
      {/* Background grid (static, no animation) */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: `linear-gradient(${darkMode ? 'rgba(70,120,133,0.06)' : 'rgba(37,81,94,0.05)'} 1px, transparent 1px), linear-gradient(90deg, ${darkMode ? 'rgba(70,120,133,0.06)' : 'rgba(37,81,94,0.05)'} 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
      {/* ── Left Nav Sidebar ── */}
      <nav style={{ width: '210px', position: 'fixed', top: 0, bottom: 0, left: 0, background: darkMode ? '#0d1820' : '#e6eef2', borderRight: `1px solid ${darkMode ? '#1e3d4f' : '#b8cdd6'}`, display: 'flex', flexDirection: 'column', zIndex: 200, overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${darkMode ? '#1e3d4f' : '#b8cdd6'}`, textAlign: 'center' }}>
          <img src={customLogo || '/logo.png'} alt="logo" style={{ maxWidth: '160px', maxHeight: '80px', objectFit: 'contain', marginBottom: '8px', filter: darkMode ? 'drop-shadow(0 0 10px rgba(168,152,124,0.35))' : 'none' }} />
          <div style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '0.12em', color: '#A8987C', textShadow: darkMode ? '0 0 16px rgba(168,152,124,0.3)' : 'none' }}>ServerCTL</div>
          <div style={{ fontSize: '9px', color: '#467885', marginTop: '3px', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Intelligence Control</div>
        </div>
        {/* Nav items */}
        <div style={{ flex: 1, padding: '6px 0' }}>
          {navItems.map(item => {
            const active = navSection === item.key || (navSection === 'manage' && item.key === 'servers');
            const updatesBadge = item.key === 'updates' && servers.some(s => s.pending_updates?.count > 0)
              ? servers.reduce((sum, s) => sum + (s.pending_updates?.count || 0), 0) : 0;
            return (
              <button key={item.key} onClick={() => { setNavSection(item.key); if (item.key === 'servers') setServerQuickFilter('all'); if (item.key === 'settings' && isAdmin) fetchUsers(); }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', border: 'none', borderLeft: `2px solid ${active ? '#A8987C' : 'transparent'}`, background: active ? (darkMode ? 'rgba(168,152,124,0.08)' : 'rgba(37,81,94,0.08)') : 'transparent', color: active ? '#A8987C' : c.textMuted, cursor: 'pointer', fontSize: '12px', fontWeight: active ? '700' : '400', width: '100%', textAlign: 'left', letterSpacing: active ? '0.04em' : '0', position: 'relative' }}>
                <span style={{ fontSize: '13px', width: '18px', textAlign: 'center', flexShrink: 0, filter: active ? (darkMode ? 'drop-shadow(0 0 4px #A8987C)' : 'none') : 'none' }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {updatesBadge > 0 && <span style={{ background: '#e8a838', color: '#16232E', fontSize: '9px', fontWeight: '800', padding: '1px 5px', letterSpacing: '0.05em' }}>{updatesBadge}</span>}
              </button>
            );
          })}
        </div>
        {/* User info at bottom */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${darkMode ? '#1e3d4f' : '#b8cdd6'}`, fontSize: '11px' }}>
          <div style={{ fontWeight: '700', color: '#A8987C', marginBottom: '1px', letterSpacing: '0.06em', fontFamily: '"Hack", "Courier New", monospace' }}>{user?.username}</div>
          <div style={{ color: '#467885', marginBottom: '10px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{isAdmin ? '// Administrator' : '// User'}</div>
          <button onClick={handleLogout} style={{ ...styles.btn, background: 'transparent', color: '#f06060', border: '1px solid #f0606040', fontSize: '11px', padding: '5px 10px', width: '100%', justifyContent: 'center', letterSpacing: '0.08em', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))' }}>Sign Out</button>
          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '9px', color: '#467885', letterSpacing: '0.1em' }}>v{import.meta.env.VITE_APP_VERSION || '1.1.0'}</div>
        </div>
      </nav>

      {/* ── Main content area ── */}
      <div style={{ marginLeft: '210px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: `1px solid ${darkMode ? '#1e3d4f' : '#b8cdd6'}`, background: darkMode ? '#0d1820' : '#e6eef2', position: 'sticky', top: 0, zIndex: 100 }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '0.08em', color: '#A8987C', textTransform: 'uppercase', fontFamily: '"Hack", "Courier New", monospace', textShadow: darkMode ? '0 0 16px rgba(168,152,124,0.25)' : 'none' }}>
              {navSection === 'manage' && selectedServer ? selectedServer.name : (navItems.find(n => n.key === navSection)?.label || customTabTitle)}
            </div>
            <div style={{ fontSize: '11px', color: '#467885', marginTop: '2px', letterSpacing: '0.12em' }}>
              ◈ {user?.username}
              <span style={{ marginLeft: '10px', background: isAdmin ? 'rgba(168,152,124,0.12)' : 'rgba(61,214,140,0.12)', color: isAdmin ? '#A8987C' : '#3dd68c', padding: '1px 7px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em' }}>{isAdmin ? 'ADMIN' : 'USER'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setDarkMode(!darkMode)} style={{ ...styles.btn, background: 'transparent', border: `1px solid ${darkMode ? '#2a5063' : '#b8cdd6'}`, color: c.textMuted, padding: '6px 12px', fontSize: '13px', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))' }}>{darkMode ? '◑' : '◐'}</button>
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: '24px', flex: 1 }}>


      {/* ── SERVERS section ── */}
      {navSection === 'servers' && <>

      {/* Quick filter banner */}
      {serverQuickFilter !== 'all' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '10px 16px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', background: serverQuickFilter === 'needs_reboot' ? '#ef444415' : '#f59e0b15', border: `1px solid ${serverQuickFilter === 'needs_reboot' ? '#ef444440' : '#f59e0b40'}` }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: serverQuickFilter === 'needs_reboot' ? '#ef4444' : '#f59e0b' }}>
            {serverQuickFilter === 'needs_reboot' ? `⚠ ${filteredServers.length} server(a) zahtijeva reboot` : `↑ ${filteredServers.length} server(a) ima dostupne update-e`}
          </span>
          {serverQuickFilter === 'needs_reboot' && (
            <button onClick={() => promptReboot(filteredServers.map(s => ({ id: s.id, name: s.name, host: s.host, pending_updates: s.pending_updates })))}
              style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '7px', padding: '5px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
              ↺ Rebootuj sve
            </button>
          )}
          <button onClick={() => setServerQuickFilter('all')} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', color: c.textMuted, padding: '2px 8px', borderRadius: '6px' }}>✕ Resetuj filter</button>
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total Servers', value: servers.length, color: '#3b82f6', icon: '▦', sub: 'registered' },
          { label: 'Online', value: onlineCount, color: '#22c55e', icon: '●', sub: 'reachable' },
          { label: 'Offline', value: offlineCount, color: '#ef4444', icon: '○', sub: 'unreachable' },
          { label: 'Backend', value: hostStatus === null ? '…' : hostStatus.online ? 'OK' : 'DOWN', color: hostStatus?.online !== false ? '#22c55e' : '#ef4444', icon: '⬡', sub: 'host status' },
        ].map(stat => (
          <div key={stat.label} style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', padding: '18px 20px', border: `1px solid ${c.border}`, borderTop: `3px solid ${stat.color}`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '14px', right: '16px', fontSize: '22px', opacity: 0.15, color: stat.color }}>{stat.icon}</div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
            <div style={{ fontSize: '34px', fontWeight: '800', color: stat.color, lineHeight: 1.1, marginTop: '6px' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: c.textMuted, marginTop: '4px' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {['all', 'online', 'offline'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} style={{ ...styles.btn, padding: '6px 14px', fontSize: '13px', background: statusFilter === f ? c.primary : c.card, color: statusFilter === f ? '#fff' : c.textMuted, border: `1px solid ${statusFilter === f ? c.primary : c.border}` }}>
              {f === 'all' ? `All (${servers.length})` : f === 'online' ? `Online (${onlineCount})` : `Offline (${offlineCount})`}
            </button>
          ))}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: c.textMuted, fontSize: '13px', pointerEvents: 'none' }}>🔍</span>
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
          <label style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '13px', cursor: 'pointer' }}>
            <input type="file" onChange={handleCSV} style={{ display: 'none' }} accept=".csv" />
            Import
          </label>
          <button onClick={exportCSV} style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '13px' }}>Export</button>
          <button onClick={() => setShowBulkPanel(!showBulkPanel)} style={{ ...styles.btn, background: selectedServers.length > 0 ? '#f59e0b' : c.cardHover, color: selectedServers.length > 0 ? '#fff' : c.textMuted, border: `1px solid ${c.border}`, fontSize: '13px' }}>
            Bulk {selectedServers.length > 0 && `(${selectedServers.length})`}
          </button>
          <button onClick={syncAllStatus} disabled={syncingStatus} title="Sync update &amp; reboot status for all online servers"
            style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '13px', position: 'relative' }}>
            <span style={{ display: 'inline-block', animation: syncingStatus ? 'spin 0.8s linear infinite' : 'none' }}>↺</span>
            {syncingStatus && <span style={{ marginLeft: '5px', fontSize: '11px' }}>Syncing...</span>}
          </button>
          <div style={{ display: 'flex', border: `1px solid ${c.border}`, clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', overflow: 'hidden' }}>
            <button onClick={() => setViewMode('grid')} title="Grid view" style={{ ...styles.btn, padding: '8px 12px', borderRadius: 0, background: viewMode === 'grid' ? c.primary : c.card, color: viewMode === 'grid' ? '#fff' : c.textMuted, border: 'none', fontSize: '15px' }}>⊞</button>
            <button onClick={() => setViewMode('list')} title="List view" style={{ ...styles.btn, padding: '8px 12px', borderRadius: 0, background: viewMode === 'list' ? c.primary : c.card, color: viewMode === 'list' ? '#fff' : c.textMuted, border: 'none', fontSize: '15px' }}>≡</button>
          </div>
        </div>
      </div>

      {showBulkPanel && (
        <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: c.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Bulk Actions — <span style={{ color: c.primary }}>{selectedServers.length} selected</span>
            </div>
            {bulkProgress.length > 0 && !bulkActionLoading && (
              <button onClick={() => setBulkProgress([])} style={{ ...styles.btn, padding: '3px 10px', fontSize: '11px', background: c.cardHover, border: `1px solid ${c.border}` }}>Clear</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => runBulkAction('update')} style={{ ...styles.btn, ...styles.btnPrimary }} disabled={bulkActionLoading}>Check Updates</button>
            <button onClick={() => runBulkAction('upgrade')} style={{ ...styles.btn, background: '#22c55e', color: '#fff', border: 'none' }} disabled={bulkActionLoading}>Upgrade Packages</button>
            {isAdmin && <button onClick={handleBulkDelete} disabled={bulkActionLoading} style={{ ...styles.btn, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>Delete ({selectedServers.length})</button>}
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
        <div style={{ textAlign: 'center', padding: '60px', color: c.textMuted }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>⬡</div>Loading servers...
        </div>
      ) : filteredServers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: c.textMuted }}>
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
                style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${isSelected ? c.primary : c.border}`, overflow: 'hidden', transition: 'transform 0.15s, box-shadow 0.15s', boxShadow: hoveredRow === s.id ? '0 8px 24px rgba(0,0,0,0.15)' : '0 1px 4px rgba(0,0,0,0.06)', transform: hoveredRow === s.id ? 'translateY(-2px)' : 'none', position: 'relative' }}
                onMouseEnter={() => setHoveredRow(s.id)} onMouseLeave={() => setHoveredRow(null)}
              >
                <div style={{ height: '3px', background: s.online ? 'linear-gradient(90deg,#22c55e,#10b981)' : '#334155' }} />
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleServerSelection(s.id)} style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.online ? '#22c55e' : '#ef4444', boxShadow: s.online ? '0 0 6px #22c55e80' : 'none' }} />
                        <span style={{ fontSize: '12px', fontWeight: '600', color: s.online ? '#22c55e' : '#ef4444' }}>{s.online ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {pu?.count > 0 && <span title={`${pu.count} updates available`} style={{ background: '#f59e0b20', color: '#f59e0b', fontSize: '11px', padding: '1px 6px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', fontWeight: '700' }}>↑{pu.count}</span>}
                      <span style={{ fontSize: '11px', background: c.cardHover, color: c.textMuted, padding: '2px 8px', borderRadius: '20px', fontWeight: '500' }}>{s.group || 'default'}</span>
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(s.name || '')}</div>
                    <div style={{ fontSize: '12px', color: c.textMuted, fontFamily: '"Hack", "Courier New", monospace' }}>{String(s.host || '')}</div>
                  </div>
                  {sm ? (
                    <div style={{ marginBottom: '12px' }}>
                      {[['CPU', sm.cpu_percent, '#3b82f6'],['RAM', sm.ram_percent, '#8b5cf6'],['Disk', sm.disk_percent, '#f59e0b']].map(([lbl, val, col]) => (
                        <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '10px', color: c.textMuted, width: '28px', fontWeight: '600' }}>{lbl}</span>
                          <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: c.cardHover, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${val || 0}%`, background: col, transition: 'width 0.4s' }} />
                          </div>
                          <span style={{ fontSize: '10px', color: c.textMuted, width: '32px', textAlign: 'right' }}>{val}%</span>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ marginBottom: '12px', fontSize: '11px', color: c.textMuted }}>{s.online ? 'Loading metrics...' : 'No metrics available'}</div>}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleServerClick(s)} style={{ flex: 1, ...styles.btn, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', fontSize: '13px', justifyContent: 'center', padding: '8px' }}>Manage</button>
                    {isAdmin && <button onClick={() => handleDelete(s.id)} style={{ ...styles.btn, ...styles.btnSecondary, padding: '8px 12px', fontSize: '13px' }}>✕</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List / Table view — Docker-style */
        <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: darkMode ? '#0f172a' : '#f1f5f9', borderBottom: `2px solid ${c.border}` }}>
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
                    style={{ borderBottom: `1px solid ${c.border}30`, background: hoveredRow === s.id ? c.cardHover : 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={() => setHoveredRow(s.id)} onMouseLeave={() => setHoveredRow(null)}>
                    <td style={{ ...styles.td, width: '32px' }}>
                      <input type="checkbox" checked={selectedServers.includes(s.id)} onChange={() => toggleServerSelection(s.id)} />
                    </td>
                    {/* Name */}
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: s.online ? '#22c55e' : '#ef4444', boxShadow: s.online ? '0 0 5px #22c55e80' : 'none' }} />
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '13px' }}>{String(s.name || '')}</div>
                          <div style={{ fontSize: '11px', color: c.textMuted, fontFamily: '"Hack", "Courier New", monospace' }}>{String(s.host || '')}</div>
                        </div>
                      </div>
                    </td>
                    {/* OS / Distro */}
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>{osIcon}</span>
                        <span style={{ fontSize: '12px', color: c.textMuted }}>{platform || 'Unknown'}</span>
                      </div>
                    </td>
                    {/* State */}
                    <td style={styles.td}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', fontSize: '11px', fontWeight: '700',
                        background: s.online ? '#22c55e18' : '#ef444418',
                        color: s.online ? '#22c55e' : '#ef4444',
                        border: `1px solid ${s.online ? '#22c55e40' : '#ef444440'}`
                      }}>
                        {s.online ? 'running' : 'stopped'}
                      </span>
                    </td>
                    {/* CPU */}
                    <td style={{ ...styles.td, minWidth: '90px' }}>
                      {sm ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: c.cardHover, overflow: 'hidden', minWidth: '48px' }}>
                              <div style={{ height: '100%', width: `${sm.cpu_percent || 0}%`, background: sm.cpu_percent > 80 ? '#ef4444' : sm.cpu_percent > 50 ? '#f59e0b' : '#3b82f6', transition: 'width 0.4s' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: c.textMuted, whiteSpace: 'nowrap' }}>{sm.cpu_percent}%</span>
                          </div>
                        </div>
                      ) : <span style={{ fontSize: '11px', color: c.textMuted }}>—</span>}
                    </td>
                    {/* Memory */}
                    <td style={{ ...styles.td, minWidth: '110px' }}>
                      {sm ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: c.cardHover, overflow: 'hidden', minWidth: '48px' }}>
                              <div style={{ height: '100%', width: `${sm.ram_percent || 0}%`, background: sm.ram_percent > 80 ? '#ef4444' : sm.ram_percent > 60 ? '#f59e0b' : '#8b5cf6', transition: 'width 0.4s' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: c.textMuted, whiteSpace: 'nowrap' }}>{sm.ram_used_gb}G / {sm.ram_total_gb}G</span>
                          </div>
                        </div>
                      ) : <span style={{ fontSize: '11px', color: c.textMuted }}>—</span>}
                    </td>
                    {/* IP */}
                    <td style={{ ...styles.td, fontFamily: '"Hack", "Courier New", monospace', fontSize: '12px', color: c.textMuted }}>{s.host}</td>
                    {/* Updates */}
                    <td style={styles.td}>
                      {pu?.count > 0
                        ? <span style={{ background: '#f59e0b18', color: '#f59e0b', fontSize: '11px', padding: '2px 8px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', fontWeight: '700', border: '1px solid #f59e0b40', whiteSpace: 'nowrap' }}>↑ {pu.count} pkg</span>
                        : <span style={{ fontSize: '11px', color: '#22c55e', opacity: 0.7 }}>✓ up to date</span>}
                    </td>
                    {/* Reboot required */}
                    <td style={styles.td}>
                      {pu?.reboot_required ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ background: '#ef444418', color: '#ef4444', fontSize: '11px', padding: '2px 8px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', fontWeight: '700', border: '1px solid #ef444440', whiteSpace: 'nowrap' }}>⚠ Required</span>
                          <button onClick={() => promptReboot([{ id: s.id, name: s.name, host: s.host, pending_updates: s.pending_updates }])}
                            style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            ↺ Reboot
                          </button>
                        </div>
                      ) : <span style={{ fontSize: '11px', color: c.textMuted, opacity: 0.4 }}>—</span>}
                    </td>
                    {/* Stack / Group */}
                    <td style={styles.td}>
                      <span style={{ ...styles.groupBadge, fontSize: '11px' }}>{s.group || '—'}</span>
                    </td>
                    {/* Actions */}
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button title="Manage" onClick={() => handleServerClick(s)}
                          style={{ ...styles.iconBtn, background: '#3b82f618', color: '#3b82f6', border: '1px solid #3b82f630' }}>
                          ⚙
                        </button>
                        <button title="SSH Terminal" onClick={() => { setShellServer(s); setShellConnected(false); setShellSessionKey(0); setNavSection('shell'); }}
                          style={{ ...styles.iconBtn, background: '#8b5cf618', color: '#8b5cf6', border: '1px solid #8b5cf630' }}>
                          ⌨
                        </button>
                        <button title="Check Updates" onClick={() => { handleServerClick(s); setActiveTab('actions'); }}
                          style={{ ...styles.iconBtn, background: '#f59e0b18', color: '#f59e0b', border: '1px solid #f59e0b30' }}>
                          ↑
                        </button>
                        {isAdmin && (
                          <button title="Delete" onClick={() => handleDelete(s.id)}
                            style={{ ...styles.iconBtn, background: '#ef444418', color: '#ef4444', border: '1px solid #ef444430' }}>
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
        const osColors = ['#3b82f6','#22c55e','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316'];
        const osEntries = Object.entries(osCounts).sort((a,b) => b[1]-a[1]);
        // Donut SVG helper
        const DonutChart = ({ segments, size = 110, sw = 20 }) => {
          const r = (size - sw) / 2;
          const circ = 2 * Math.PI * r;
          let off = 0;
          return (
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={darkMode ? '#1e293b' : '#f1f5f9'} strokeWidth={sw} />
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
                <div style={{ fontSize: '12px', color: c.textMuted }}>Live status across all registered hosts</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: c.textMuted }}>All Hosts</span>
                <button onClick={fetchServers} style={{ ...styles.btn, ...styles.btnSecondary, padding: '6px 14px', fontSize: '12px' }}>↺ Refresh</button>
              </div>
            </div>

            {/* Top stat strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px' }}>
              {[
                { label: 'Total Hosts',    value: totalHosts,    color: '#3b82f6', sub: 'registered', icon: '⬡' },
                { label: 'Online',         value: `${onlineHosts}/${totalHosts}`, color: '#22c55e', sub: `${onlinePct}% reachable`, icon: '◉' },
                { label: 'Up to Date',     value: upToDate,      color: '#10b981', sub: `${upToDatePct}% compliant`, icon: '✓' },
                { label: 'Need Updates',   value: needsUpdate,   color: needsUpdate > 0 ? '#f59e0b' : '#22c55e', sub: `${100 - upToDatePct}% outdated`, icon: '↑', filter: 'needs_update' },
                { label: 'Needs Reboot',   value: needsReboot,   color: needsReboot > 0 ? '#ef4444' : '#22c55e', sub: 'after upgrade', icon: '⚠', filter: 'needs_reboot' },
              ].map(s => (
                <div key={s.label}
                  onClick={() => { if (s.filter) { setServerQuickFilter(s.filter); setStatusFilter('all'); setGroupFilter('all'); setSearchQuery(''); setNavSection('servers'); } }}
                  style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', padding: '16px 18px', border: `1px solid ${c.border}`, borderTop: `3px solid ${s.color}`, position: 'relative', overflow: 'hidden', cursor: s.filter ? 'pointer' : 'default', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { if (s.filter) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${s.color}30`; } }}
                  onMouseLeave={e => { if (s.filter) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; } }}
                >
                  <div style={{ position: 'absolute', top: '12px', right: '14px', fontSize: '20px', opacity: 0.08 }}>{s.icon}</div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{s.label}</div>
                  <div style={{ fontSize: '30px', fontWeight: '800', color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '11px', color: c.textMuted, marginTop: '4px' }}>{s.sub}</div>
                  {s.filter && <div style={{ position: 'absolute', bottom: '10px', right: '12px', fontSize: '10px', color: s.color, opacity: 0.6 }}>View →</div>}
                </div>
              ))}
            </div>

            {/* Second row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
              {[
                { label: 'Outdated Packages', value: totalPkgs,  color: '#f97316', icon: '📦' },
                { label: 'Security Updates',  value: 0,          color: '#ef4444', icon: '🔒' },
                { label: 'Compliance',        value: `${compliance}/${totalHosts}`, color: compliance === totalHosts ? '#22c55e' : '#f59e0b', icon: '✅' },
                { label: 'Avg Pkgs / Host',   value: totalHosts > 0 ? Math.round(totalPkgs / totalHosts) : 0, color: '#8b5cf6', icon: '∅' },
              ].map(s => (
                <div key={s.label} style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', padding: '14px 16px', border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ fontSize: '24px', opacity: 0.7, flexShrink: 0 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: s.color, lineHeight: 1.1 }}>{s.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {/* OS Distribution */}
              <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', padding: '20px', border: `1px solid ${c.border}` }}>
                <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '14px', color: c.text }}>OS Distribution</div>
                {totalHosts === 0 ? <div style={{ fontSize: '12px', color: c.textMuted }}>No hosts registered</div> : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <DonutChart
                        segments={osEntries.map(([,n], i) => ({ pct: Math.round(n / totalHosts * 100), color: osColors[i % osColors.length] }))}
                        size={110} sw={20}
                      />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <div style={{ fontSize: '22px', fontWeight: '800', lineHeight: 1 }}>{totalHosts}</div>
                        <div style={{ fontSize: '10px', color: c.textMuted }}>hosts</div>
                      </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {osEntries.map(([os, cnt], i) => (
                        <div key={os} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: osColors[i % osColors.length], flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', flex: 1, fontWeight: '500' }}>{os}</span>
                          <span style={{ fontSize: '11px', color: c.textMuted, fontWeight: '700' }}>{cnt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Update Status */}
              <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', padding: '20px', border: `1px solid ${c.border}` }}>
                <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '14px', color: c.text }}>Update Status</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Up to date',    count: upToDate,             color: '#22c55e' },
                    { label: 'Need updates',  count: needsUpdate,          color: '#f59e0b' },
                    { label: 'Needs reboot',  count: needsReboot,          color: '#ef4444' },
                    { label: 'Offline',       count: totalHosts - onlineHosts, color: '#64748b' },
                  ].map(row => (
                    <div key={row.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: c.textMuted }}>{row.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: row.color }}>{row.count}</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: darkMode ? '#1a2d3a' : '#f0f5f8', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${totalHosts > 0 ? (row.count / totalHosts * 100) : 0}%`, background: row.color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: c.textMuted }}>Compliance rate</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: upToDatePct === 100 ? '#22c55e' : '#f59e0b' }}>{upToDatePct}%</span>
                </div>
              </div>

              {/* Online Servers list */}
              <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', padding: '20px', border: `1px solid ${c.border}`, overflow: 'hidden' }}>
                <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '14px', color: c.text }}>Host Status</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '200px' }}>
                  {servers.length === 0 && <div style={{ fontSize: '12px', color: c.textMuted }}>No hosts registered</div>}
                  {servers.slice(0, 12).map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: `1px solid ${c.border}10` }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: s.online ? '#22c55e' : '#ef4444', boxShadow: s.online ? '0 0 4px #22c55e80' : 'none' }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(s.name||'')}</span>
                      {s.pending_updates?.reboot_required && <span title="Reboot required" style={{ fontSize: '10px', color: '#ef4444' }}>⚠</span>}
                      {s.pending_updates?.count > 0 && <span style={{ fontSize: '10px', background: '#f59e0b20', color: '#f59e0b', padding: '1px 5px', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', fontWeight: '700' }}>↑{s.pending_updates.count}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Servers needing updates */}
            {needsUpdate > 0 && (
              <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', padding: '20px', border: `1px solid ${c.border}` }}>
                <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '12px', color: c.text }}>Servers Needing Updates</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {servers.filter(s => s.pending_updates?.count > 0).map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', background: darkMode ? '#0d1820' : '#f0f5f8', border: `1px solid ${c.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.online ? '#22c55e' : '#ef4444', boxShadow: s.online ? '0 0 4px #22c55e80' : 'none' }} />
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '13px' }}>{String(s.name||'')}</div>
                          <div style={{ fontSize: '11px', color: c.textMuted, fontFamily: '"Hack", "Courier New", monospace' }}>{s.host}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {s.pending_updates.reboot_required && <span style={{ background: '#ef444418', color: '#ef4444', fontSize: '10px', padding: '1px 7px', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', fontWeight: '700', border: '1px solid #ef444440' }}>⚠ Reboot</span>}
                        <span style={{ background: '#f59e0b18', color: '#f59e0b', fontSize: '11px', padding: '2px 8px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', fontWeight: '700', border: '1px solid #f59e0b40' }}>↑ {s.pending_updates.count} pkg</span>
                        <button onClick={() => { handleServerClick(s); }} style={{ ...styles.iconBtn, background: '#3b82f618', color: '#3b82f6', border: '1px solid #3b82f630', fontSize: '11px' }}>Manage</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}


      {/* ── NETWORKS section ── */}
      {navSection === 'networks' && (
        <div style={{ width: '100%' }}>
          {/* Top row: Network Scan + Speed Test side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, padding: '20px' }}>
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
          <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, padding: '20px' }}>
            {(() => {
              const selSrv = servers.find(s => s.id === repoTestServer);
              const isWin = selSrv ? String(selSrv.platform || '').toLowerCase().includes('windows') : false;
              return <>
                <h3 style={{ ...styles.cardTitle, marginBottom: '4px' }}>{isWin ? 'Windows CDN Speed Test' : 'Repository Speed Test'}</h3>
                <div style={{ fontSize: '11px', color: c.textMuted, marginBottom: '12px' }}>
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
              {repoTestLoading && <div style={{ width: '14px', height: '14px', border: `2px solid ${c.primary}40`, borderTopColor: c.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
            </div>
            {repoTestResult && (
              <div style={{ marginTop: '12px', background: darkMode ? '#0d1820' : '#f0f5f8', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', padding: '10px 14px', fontFamily: '"Hack", "Courier New", monospace', fontSize: '12px', color: c.text, whiteSpace: 'pre-wrap', border: `1px solid ${c.border}` }}>
                {repoTestResult}
              </div>
            )}
          </div>
          </div>{/* end top grid */}

          {/* Ping Monitor — full width */}
          <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, padding: '20px' }}>
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

            {servers.length === 0 && <div style={{ fontSize: '12px', color: c.textMuted }}>No servers registered.</div>}

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
                if (!r) return '#94a3b8';
                if (r.http_status) {
                  if (r.http_status < 300) return '#22c55e';
                  if (r.http_status < 400) return '#f59e0b';
                  return '#ef4444';
                }
                if (r.status === 'up' || r.status === 'open') return '#22c55e';
                if (r.status === 'open|filtered') return '#f59e0b';
                return '#ef4444';
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
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', cursor: 'pointer',
                          background: selected ? (darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.05)') : (darkMode ? '#0f172a' : '#f8fafc'),
                          border: `1px solid ${selected ? c.primary + '60' : c.border}`, transition: 'all 0.15s' }}>
                        {/* Checkbox */}
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${selected ? c.primary : c.border}`, background: selected ? c.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {selected && <div style={{ width: '8px', height: '6px', borderLeft: '2px solid #fff', borderBottom: '2px solid #fff', transform: 'rotate(-45deg) translate(1px,-1px)' }} />}
                        </div>
                        {/* Status dot */}
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, boxShadow: (r?.status === 'up' || r?.status === 'open') ? `0 0 6px ${color}80` : 'none', flexShrink: 0 }} />
                        {/* Server info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(srv.name || srv.host)}</div>
                          <div style={{ fontSize: '11px', color: c.textMuted, fontFamily: '"Hack", "Courier New", monospace' }}>{srv.host}{probeType === 'db' ? ` · ${probeDb}` : probeType === 'tcp' || probeType === 'udp' ? ` · ${probeType.toUpperCase()}:${probePort || '?'}` : ''}</div>
                        </div>
                        {/* Result + tooltip */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', fontFamily: '"Hack", "Courier New", monospace', color }}>{resultLabel(r)}</div>
                            {r?.ts && <div style={{ fontSize: '10px', color: c.textMuted }}>{r.ts}</div>}
                          </div>
                          {tip && (
                            <div className="probe-info-wrap" style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                              <div className="probe-info-icon" style={{ width: '16px', height: '16px', borderRadius: '50%', background: darkMode ? '#334155' : '#e2e8f0', color: c.textMuted, fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', userSelect: 'none' }}>ⓘ</div>
                              <div className="probe-tooltip" style={{ display: 'none', position: 'absolute', right: 0, bottom: '22px', width: '260px', background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${c.border}`, clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', padding: '10px 12px', fontSize: '12px', color: c.text, lineHeight: '1.5', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 100 }}>
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

      {/* ── UPDATES section ── */}
      {navSection === 'updates' && (() => {
        const updServers = servers.filter(s => s.pending_updates?.count > 0);
        const selUpdates = selectedServers.filter(id => updServers.some(s => s.id === id));
        const allUpdSelected = updServers.length > 0 && updServers.every(s => selectedServers.includes(s.id));
        return (
          <div>
            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '13px', color: c.textMuted }}>
                {updServers.length} server{updServers.length !== 1 ? 's' : ''} with pending updates
                {selUpdates.length > 0 && <span style={{ color: c.primary, fontWeight: '600' }}> — {selUpdates.length} selected</span>}
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
                {isAdmin && (
                  <button onClick={updateAllAgents} disabled={updatingAgents}
                    title="Push latest agent to all online servers"
                    style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '12px' }}>
                    {updatingAgents ? '⟳ Updating...' : '⬆ Update All Agents'}
                  </button>
                )}
                {selUpdates.length > 0 && (
                  <button onClick={() => upgradeServers(selUpdates)} disabled={bulkActionLoading}
                    style={{ ...styles.btn, background: '#22c55e', color: '#fff', border: 'none', fontSize: '12px' }}>
                    {bulkActionLoading ? 'Upgrading...' : `↑ Upgrade ${selUpdates.length} Server${selUpdates.length > 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            </div>

            {/* Bulk progress */}
            {bulkProgress.length > 0 && (
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bulkProgress.map(p => (
                  <div key={p.id} style={{ background: darkMode ? '#0d1820' : '#f0f5f8', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', padding: '10px 14px', border: `1px solid ${c.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.status === 'done' ? '#22c55e' : p.status === 'error' ? '#ef4444' : p.status === 'running' ? '#f59e0b' : c.border, animation: p.status === 'running' ? 'pulse 1s infinite' : 'none' }} />
                        <span style={{ fontWeight: '600', fontSize: '13px' }}>{p.name}</span>
                        <span style={{ fontSize: '11px', color: c.textMuted, fontFamily: '"Hack", "Courier New", monospace' }}>{p.host}</span>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: p.status === 'done' ? '#22c55e' : p.status === 'error' ? '#ef4444' : p.status === 'running' ? '#f59e0b' : c.textMuted }}>{p.status}</span>
                    </div>
                    <div style={{ height: '5px', borderRadius: '3px', background: darkMode ? '#1e293b' : '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: p.status === 'pending' ? '0%' : p.status === 'running' ? '60%' : '100%', borderRadius: '3px', background: p.status === 'done' ? 'linear-gradient(90deg,#22c55e,#10b981)' : p.status === 'error' ? '#ef4444' : 'linear-gradient(90deg,#f59e0b,#fbbf24)', transition: p.status !== 'running' ? 'width 0.5s' : 'none', animation: p.status === 'running' ? 'shimmer 1.5s linear infinite' : 'none', backgroundSize: '200% 100%' }} />
                    </div>
                    {p.output && p.status !== 'pending' && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: c.textMuted, fontFamily: '"Hack", "Courier New", monospace', whiteSpace: 'pre-wrap', maxHeight: '60px', overflowY: 'auto', background: darkMode ? '#020617' : '#f1f5f9', borderRadius: '4px', padding: '4px 8px' }}>
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
                  <div key={s.id} style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${isSelected ? c.primary : c.border}`, marginBottom: '12px', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: `1px solid ${c.border}`, background: darkMode ? '#0d1820' : '#f0f5f8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleServerSelection(s.id)} style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: c.primary }} />
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.online ? '#22c55e' : '#ef4444', boxShadow: s.online ? '0 0 5px #22c55e80' : 'none' }} />
                        <div>
                          <span style={{ fontWeight: '700', fontSize: '14px' }}>{String(s.name||'')}</span>
                          <span style={{ fontSize: '12px', color: c.textMuted, fontFamily: '"Hack", "Courier New", monospace', marginLeft: '8px' }}>{s.host}</span>
                        </div>
                        {s.pending_updates?.reboot_required && <span style={{ background: '#ef444418', color: '#ef4444', fontSize: '10px', padding: '1px 7px', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', fontWeight: '700', border: '1px solid #ef444440' }}>⚠ Reboot after</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ background: '#f59e0b18', color: '#f59e0b', fontSize: '12px', padding: '3px 10px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', fontWeight: '700', border: '1px solid #f59e0b40' }}>↑ {s.pending_updates.count} pkg</span>
                        {s.online && (
                          <button onClick={() => upgradeServers([s.id])} disabled={bulkActionLoading}
                            style={{ ...styles.btn, background: '#22c55e', color: '#fff', border: 'none', padding: '5px 14px', fontSize: '12px' }}>
                            Upgrade
                          </button>
                        )}
                        <button onClick={() => handleServerClick(s)} style={{ ...styles.btn, ...styles.btnSecondary, padding: '5px 12px', fontSize: '12px' }}>Manage</button>
                      </div>
                    </div>
                    <div style={{ padding: '10px 18px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {s.pending_updates.packages?.map((pkg, i) => (
                        <span key={i} style={{ background: c.cardHover, fontSize: '11px', fontFamily: '"Hack", "Courier New", monospace', padding: '2px 8px', borderRadius: '4px', color: c.textMuted }}>{pkg}</span>
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
          <div style={{ background: darkMode ? 'rgba(30,41,59,0.80)' : 'rgba(255,255,255,0.80)', backdropFilter: 'blur(10px)', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, fontSize: '12px', fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Online Servers</div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {servers.filter(s => s.online).length === 0 && <div style={{ padding: '20px', fontSize: '13px', color: c.textMuted }}>No servers online</div>}
              {servers.filter(s => s.online).map(s => (
                <div key={s.id} onClick={() => selectLogsServer(s)}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${c.border}20`, background: logsServer?.id === s.id ? (darkMode ? '#1e3a5f' : '#dbeafe') : 'transparent', borderLeft: `3px solid ${logsServer?.id === s.id ? c.primary : 'transparent'}`, transition: 'all 0.1s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e80', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600' }}>{String(s.name || '')}</div>
                      <div style={{ fontSize: '11px', color: c.textMuted, fontFamily: '"Hack", "Courier New", monospace' }}>{s.host}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Log viewer panel */}
          <div style={{ background: darkMode ? 'rgba(30,41,59,0.80)' : 'rgba(255,255,255,0.80)', backdropFilter: 'blur(10px)', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!logsServer ? (
              <div style={styles.empty}>
                <div style={{ fontSize: '36px', opacity: 0.3, marginBottom: '12px' }}>📋</div>
                <div style={{ fontWeight: '600' }}>Select a server to view logs</div>
              </div>
            ) : (
              <>
                {/* Top bar */}
                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: '10px', background: darkMode ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.7)', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: '600', fontSize: '13px', marginRight: '4px' }}>{logsServer.name}</span>
                  <span style={{ fontSize: '11px', color: c.textMuted, fontFamily: '"Hack", "Courier New", monospace' }}>{logsServer.host}</span>
                  {/* Source type tabs */}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', background: darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', padding: '3px' }}>
                    {[['files', '📄 Log Files'], ['services', '⚙ Services']].map(([key, label]) => (
                      <button key={key} onClick={() => { setLogsTab(key); setLogsSelectedItem(null); setLogsContent(''); }}
                        style={{ background: logsTab === key ? c.primary : 'transparent', color: logsTab === key ? '#fff' : c.textMuted, border: 'none', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {logsSelectedItem && (
                    <>
                      <button onClick={refreshLogsContent} title="Refresh" style={{ ...styles.btn, ...styles.btnSecondary, padding: '4px 10px', fontSize: '12px' }}>↺</button>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: c.textMuted, cursor: 'pointer' }}>
                        <input type="checkbox" checked={logsAutoRefresh} onChange={e => setLogsAutoRefresh(e.target.checked)} />
                        Auto (5s)
                      </label>
                    </>
                  )}
                  {logsListLoading && <span style={{ fontSize: '12px', color: c.textMuted }}>Loading...</span>}
                </div>

                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                  {/* Source list */}
                  <div style={{ width: '200px', borderRight: `1px solid ${c.border}`, overflowY: 'auto', flexShrink: 0 }}>
                    {logsTab === 'files' && (
                      logsFiles.length === 0
                        ? <div style={{ padding: '16px', fontSize: '12px', color: c.textMuted }}>{logsListLoading ? 'Loading...' : 'No log files found'}</div>
                        : logsFiles.map((f, i) => (
                          <div key={i} onClick={() => loadLogFile(logsServer, f.path)}
                            style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: `1px solid ${c.border}15`, background: logsSelectedItem === f.path ? (darkMode ? '#1e3a5f' : '#dbeafe') : 'transparent', borderLeft: `3px solid ${logsSelectedItem === f.path ? c.primary : 'transparent'}`, transition: 'all 0.1s' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                            <div style={{ fontSize: '10px', color: c.textMuted }}>{(f.size / 1024).toFixed(1)} KB</div>
                          </div>
                        ))
                    )}
                    {logsTab === 'services' && (
                      logsServices.length === 0
                        ? <div style={{ padding: '16px', fontSize: '12px', color: c.textMuted }}>{logsListLoading ? 'Loading...' : 'No services found'}</div>
                        : logsServices.map((svc, i) => (
                          <div key={i} onClick={() => loadServiceStatus(logsServer, svc)}
                            style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: `1px solid ${c.border}15`, background: logsSelectedItem === 'svc:' + svc ? (darkMode ? '#1e3a5f' : '#dbeafe') : 'transparent', borderLeft: `3px solid ${logsSelectedItem === 'svc:' + svc ? c.primary : 'transparent'}`, transition: 'all 0.1s' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{svc}</div>
                          </div>
                        ))
                    )}
                  </div>

                  {/* Log content */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: darkMode ? '#0d1117' : '#f8fafc' }}>
                    {!logsSelectedItem && (
                      <div style={styles.empty}>
                        <div style={{ fontSize: '28px', opacity: 0.3, marginBottom: '8px' }}>{logsTab === 'files' ? '📄' : '⚙'}</div>
                        <div style={{ fontSize: '13px', color: c.textMuted }}>Select a {logsTab === 'files' ? 'log file' : 'service'} from the list</div>
                      </div>
                    )}
                    {logsSelectedItem && logsContentLoading && (
                      <div style={styles.empty}><div style={{ fontSize: '13px', color: c.textMuted }}>Loading...</div></div>
                    )}
                    {logsSelectedItem && !logsContentLoading && (
                      <pre ref={logsOutputRef}
                        style={{ flex: 1, margin: 0, padding: '14px 16px', fontFamily: '"Cascadia Code", "Source Code Pro", Menlo, monospace', fontSize: '12px', color: darkMode ? '#c9d1d9' : '#1e293b', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>
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

      {/* ── SHELL section ── */}
      {navSection === 'shell' && (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px', margin: '-24px', height: 'calc(100vh - 68px)' }}>
          {/* Server list */}
          <div style={{ background: darkMode ? 'rgba(30,41,59,0.80)' : 'rgba(255,255,255,0.80)', backdropFilter: 'blur(10px)', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${c.border}`, fontSize: '12px', fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Servers</div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {servers.filter(s => !String(s.platform || '').toLowerCase().includes('windows')).length === 0 && <div style={{ padding: '20px', fontSize: '13px', color: c.textMuted }}>No Linux servers</div>}
              {servers.filter(s => !String(s.platform || '').toLowerCase().includes('windows')).map(s => (
                <div key={s.id} onClick={() => { setShellServer(s); setShellConnected(false); setShellSessionKey(0); }}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${c.border}20`, background: shellServer?.id === s.id ? (darkMode ? '#1e3a5f' : '#dbeafe') : 'transparent', borderLeft: `3px solid ${shellServer?.id === s.id ? c.primary : 'transparent'}`, transition: 'all 0.1s', opacity: s.online ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.online ? '#22c55e' : '#ef4444', boxShadow: s.online ? '0 0 5px #22c55e80' : 'none', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600' }}>{String(s.name || '')}</div>
                      <div style={{ fontSize: '11px', color: c.textMuted, fontFamily: '"Hack", "Courier New", monospace' }}>{s.host}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Terminal panel */}
          <div style={{ background: darkMode ? 'rgba(30,41,59,0.80)' : 'rgba(255,255,255,0.80)', backdropFilter: 'blur(10px)', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!shellServer ? (
              <div style={styles.empty}>
                <div style={{ fontSize: '36px', opacity: 0.3, marginBottom: '12px' }}>⌨</div>
                <div style={{ fontWeight: '600' }}>Select a server to connect</div>
              </div>
            ) : (
              <>
                {/* Credentials bar — always on top */}
                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${c.border}`, background: darkMode ? 'rgba(15,23,42,0.7)' : 'rgba(248,250,252,0.9)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: shellConnected ? '#22c55e' : '#f59e0b', boxShadow: shellConnected ? '0 0 6px #22c55e80' : 'none', flexShrink: 0 }} />
                    <span style={{ fontWeight: '600', fontSize: '13px', marginRight: '4px' }}>{shellConnected ? `${shellUsername}@${shellServer.host}` : shellServer.host}</span>
                    {/* Username */}
                    <input value={shellUsername} onChange={e => setShellUsername(e.target.value)} placeholder="username"
                      style={{ ...styles.input, width: '120px', padding: '4px 8px', fontSize: '12px' }} />
                    {/* Auth method */}
                    <select value={shellAuthMethod} onChange={e => setShellAuthMethod(e.target.value)}
                      style={{ ...styles.input, padding: '4px 8px', fontSize: '12px' }}>
                      <option value="password">Password</option>
                      <option value="key_path">Key Path</option>
                      <option value="key_upload">Key File</option>
                    </select>
                    {/* Password / key path */}
                    {shellAuthMethod !== 'key_upload' && (
                      <input type={shellAuthMethod === 'password' ? 'password' : 'text'} value={shellPassword}
                        onChange={e => setShellPassword(e.target.value)}
                        placeholder={shellAuthMethod === 'key_path' ? '~/.ssh/id_rsa' : 'password'}
                        onKeyDown={e => e.key === 'Enter' && !shellConnected && connectShellSSH()}
                        style={{ ...styles.input, width: '160px', padding: '4px 8px', fontSize: '12px' }} />
                    )}
                    {/* Key file browse */}
                    {shellAuthMethod === 'key_upload' && (
                      <label style={{ ...styles.btn, ...styles.btnSecondary, padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>
                        {shellKeyContent ? '✓ Key loaded' : 'Browse key...'}
                        <input type="file" style={{ display: 'none' }} onChange={e => {
                          const file = e.target.files[0];
                          if (file) { const r = new FileReader(); r.onload = ev => setShellKeyContent(ev.target.result); r.readAsText(file); }
                        }} />
                      </label>
                    )}
                    {/* Connect / Disconnect */}
                    {!shellConnected
                      ? <button onClick={connectShellSSH} style={{ ...styles.btn, ...styles.btnPrimary, padding: '4px 14px', fontSize: '12px' }}>Connect</button>
                      : <button onClick={disconnectShellSSH} style={{ ...styles.btn, background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 12px', fontSize: '12px' }}>Disconnect</button>
                    }
                  </div>
                  {/* Key paste area — shown only for key_upload */}
                  {shellAuthMethod === 'key_upload' && (
                    <textarea value={shellKeyContent} onChange={e => setShellKeyContent(e.target.value)}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                      style={{ ...styles.input, width: '100%', boxSizing: 'border-box', minHeight: '60px', fontFamily: '"Hack", "Courier New", monospace', fontSize: '11px', marginTop: '8px' }} />
                  )}
                </div>

                {/* Terminal — always rendered, shows placeholder when not connected */}
                <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  {shellSessionKey === 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', color: '#475569', flexDirection: 'column', gap: '8px' }}>
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
            )}
          </div>
        </div>
      )}
      {navSection === 'activity' && (
        <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, padding: '20px' }}>
          <h3 style={{ ...styles.cardTitle, marginBottom: '16px' }}>Connected Agents</h3>
          {servers.filter(s=>s.online).map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${c.border}20` }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e80' }} />
                <span style={{ fontWeight: '600' }}>{String(s.name||'')}</span>
              </div>
              <span style={{ fontFamily: '"Hack", "Courier New", monospace', fontSize: '12px', color: c.textMuted }}>{s.host}</span>
            </div>
          ))}
          {servers.filter(s=>s.online).length === 0 && <div style={{ fontSize: '13px', color: c.textMuted }}>No agents currently connected.</div>}
        </div>
      )}
      {navSection === 'schedules' && <div style={styles.empty}><div style={{ fontSize: '40px', opacity: 0.3, marginBottom: '12px' }}>⏰</div><div style={{ fontWeight: '600' }}>Schedules — Coming Soon</div></div>}

      {/* ── SETTINGS section ── */}
      {navSection === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, padding: '20px' }}>
            <h3 style={{ ...styles.cardTitle, marginBottom: '18px' }}>Branding</h3>

            {/* Logo upload */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Logo</div>
              <div style={{ fontSize: '12px', color: c.textMuted, marginBottom: '10px' }}>Shown in the top-left of the sidebar</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {customLogo && <img src={customLogo} alt="current logo" style={{ maxHeight: '48px', maxWidth: '120px', objectFit: 'contain', borderRadius: '6px', border: `1px solid ${c.border}` }} />}
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
                {customLogo && <button onClick={() => { setCustomLogo(''); localStorage.removeItem('serverctl_logo'); }} style={{ ...styles.btn, background: '#fee2e2', color: '#dc2626', border: 'none' }}>Remove</button>}
              </div>
            </div>

            {/* Tab / app name */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>App Name</div>
              <div style={{ fontSize: '12px', color: c.textMuted, marginBottom: '10px' }}>Shown in the browser tab and sidebar</div>
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
                <div style={{ fontSize: '12px', color: c.textMuted }}>Toggle light/dark theme</div>
              </div>
              <button onClick={() => setDarkMode(!darkMode)} style={{ ...styles.btn, ...styles.btnSecondary, padding: '8px 16px' }}>{darkMode ? '☀️ Light' : '🌙 Dark'}</button>
            </div>
          </div>
          {isAdmin && (
            <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, padding: '20px' }}>
              <h3 style={{ ...styles.cardTitle, marginBottom: '4px' }}>User Management</h3>
              <div style={{ fontSize: '12px', color: c.textMuted, marginBottom: '16px' }}>Manage who can access ServerCTL</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px auto', gap: '10px', marginBottom: '16px', alignItems: 'end' }}>
                <div>
                  <div style={{ fontSize: '11px', color: c.textMuted, marginBottom: '4px' }}>USERNAME</div>
                  <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="username" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: c.textMuted, marginBottom: '4px' }}>PASSWORD</div>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="password" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: c.textMuted, marginBottom: '4px' }}>ROLE</div>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ ...styles.input }}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button onClick={createUser} style={{ ...styles.btn, ...styles.btnPrimary, alignSelf: 'end' }}>Add</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${c.border}` }}>
                    {['Username', 'Role', 'Action'].map(h => <th key={h} style={{ ...styles.th, background: 'transparent' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.username} style={{ borderBottom: `1px solid ${c.border}20` }}>
                      <td style={styles.td}><strong>{u.username}</strong> {u.username === user?.username && <span style={{ fontSize: '11px', color: '#3b82f6' }}>(you)</span>}</td>
                      <td style={styles.td}>
                        <span style={{ background: u.role === 'admin' ? '#3b82f620' : '#22c55e20', color: u.role === 'admin' ? '#3b82f6' : '#22c55e', padding: '2px 8px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', fontSize: '12px', fontWeight: '600' }}>{u.role}</span>
                      </td>
                      <td style={styles.td}>
                        {u.username !== user?.username && (
                          <button onClick={() => deleteUser(u.username)} style={{ ...styles.btn, padding: '3px 10px', fontSize: '12px', background: '#fee2e2', color: '#dc2626', border: 'none' }}>Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, padding: '20px' }}>
            <h3 style={{ ...styles.cardTitle, marginBottom: '12px' }}>Account</h3>
            <div style={{ fontSize: '13px', marginBottom: '8px' }}><span style={{ color: c.textMuted }}>Logged in as:</span> <strong>{user?.username}</strong></div>
            <div style={{ fontSize: '13px', marginBottom: '16px' }}><span style={{ color: c.textMuted }}>Role:</span> <span style={{ background: isAdmin ? '#3b82f620' : '#22c55e20', color: isAdmin ? '#3b82f6' : '#22c55e', padding: '1px 8px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', fontWeight: '600' }}>{user?.role}</span></div>
            <button onClick={handleLogout} style={{ ...styles.btn, background: '#fee2e2', color: '#dc2626', border: 'none' }}>Sign Out</button>
          </div>
        </div>
      )}

      {/* ── MANAGE section (full-width server detail) ── */}
      {navSection === 'manage' && selectedServer && (() => {
        const Section = ({ title, children }) => (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', paddingBottom: '6px', borderBottom: `1px solid ${c.border}` }}>{title}</div>
            {children}
          </div>
        );
        const Row = ({ label, value }) => (
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${c.border}15` }}>
            <div style={{ fontSize: '12px', color: c.textMuted, fontWeight: '500' }}>{label}</div>
            <div style={{ fontSize: '13px', color: c.text, fontFamily: '"Hack", "Courier New", monospace', wordBreak: 'break-all' }}>{value || '—'}</div>
          </div>
        );
        return (
          <div>
            {/* Server header bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px 16px', background: darkMode ? 'rgba(30,41,59,0.7)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}` }}>
              <button onClick={() => { setSelectedServer(null); setNavSection('servers'); }} style={{ ...styles.btn, ...styles.btnSecondary, padding: '5px 12px', fontSize: '12px', flexShrink: 0 }}>← Back</button>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: selectedServer.online ? '#22c55e' : '#ef4444', boxShadow: selectedServer.online ? '0 0 8px #22c55e80' : 'none', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', fontSize: '15px' }}>{String(selectedServer.name || '')}</div>
                <div style={{ color: c.textMuted, fontSize: '12px', fontFamily: '"Hack", "Courier New", monospace' }}>{String(selectedServer.host || '')} · {String(selectedServer.platform || 'Linux')}</div>
              </div>
              {selectedServer.pending_updates?.count > 0 && (
                <span style={{ background: '#f59e0b20', color: '#f59e0b', fontSize: '11px', padding: '2px 8px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', fontWeight: '700', border: '1px solid #f59e0b40', flexShrink: 0 }}>↑ {selectedServer.pending_updates.count} updates</span>
              )}
              {isAdmin && <button onClick={() => handleDelete(selectedServer.id)} style={{ ...styles.btn, background: '#fee2e220', color: '#ef4444', border: '1px solid #ef444430', padding: '5px 12px', fontSize: '12px', flexShrink: 0 }}>Delete</button>}
            </div>

            {/* Quick metrics strip */}
            {(() => {
              const sm = serverMetricsMap[selectedServer.id];
              if (!sm) return null;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                  {[
                    { label: 'CPU', val: sm.cpu_percent, unit: '%', color: '#3b82f6' },
                    { label: 'RAM', val: sm.ram_percent, unit: '%', sub: `${sm.ram_used_gb}/${sm.ram_total_gb} GB`, color: '#8b5cf6' },
                    { label: 'Disk', val: sm.disk_percent, unit: '%', sub: `${sm.disk_used_gb}/${sm.disk_total_gb} GB`, color: '#f59e0b' },
                  ].map(m => (
                    <div key={m.label} style={{ background: darkMode ? 'rgba(30,41,59,0.7)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', padding: '10px 14px', border: `1px solid ${c.border}` }}>
                      <div style={{ fontSize: '11px', color: c.textMuted, fontWeight: '600', marginBottom: '6px' }}>{m.label}</div>
                      <div style={{ height: '4px', borderRadius: '2px', background: c.border, marginBottom: '6px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${m.val || 0}%`, background: m.color, transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: m.color }}>{m.val}{m.unit}</div>
                      {m.sub && <div style={{ fontSize: '10px', color: c.textMuted }}>{m.sub}</div>}
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

                {sysInfoLoading && <div style={{ padding: '40px', textAlign: 'center', color: c.textMuted }}>Loading system information...</div>}
                {!sysInfoLoading && !sysInfo && (
                  <div style={{ padding: '40px', textAlign: 'center', color: c.textMuted }}>
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
                        {(sysInfo.disks || []).length === 0 && <div style={{ fontSize: '12px', color: c.textMuted }}>No disk data</div>}
                        {(sysInfo.disks || []).map((d, i) => (
                          <div key={i} style={{ marginBottom: '10px', padding: '10px 12px', background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', border: `1px solid ${c.border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontFamily: '"Hack", "Courier New", monospace', fontSize: '13px', fontWeight: '600', color: c.text }}>{d.device}</span>
                              <span style={{ fontSize: '12px', color: parseInt(d.pct) >= 90 ? '#ef4444' : parseInt(d.pct) >= 75 ? '#f59e0b' : c.success }}>{d.pct} used</span>
                            </div>
                            <div style={{ height: '4px', background: c.border, borderRadius: '2px', marginBottom: '6px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: d.pct, background: parseInt(d.pct) >= 90 ? '#ef4444' : parseInt(d.pct) >= 75 ? '#f59e0b' : '#22c55e', borderRadius: '2px', transition: 'width 0.3s' }} />
                            </div>
                            <div style={{ fontSize: '11px', color: c.textMuted }}>Size: {d.total_gb}GB ({d.used_gb}GB used, {d.free_gb}GB free)</div>
                            <div style={{ fontSize: '11px', color: c.textMuted, marginTop: '2px' }}>Mount: {d.mount}</div>
                          </div>
                        ))}
                      </Section>
                    </div>
                    <div>
                      <Section title="Network — DNS Servers">
                        {(sysInfo.dns_servers || []).length === 0
                          ? <div style={{ fontSize: '12px', color: c.textMuted }}>None found</div>
                          : (sysInfo.dns_servers || []).map((dns, i) => (
                            <div key={i} style={{ fontFamily: '"Hack", "Courier New", monospace', fontSize: '13px', padding: '4px 0', color: c.text }}>{dns}</div>
                          ))}
                      </Section>
                      <Section title="Network Interfaces">
                        {(sysInfo.interfaces || []).filter(iface => iface.type !== 'loopback').map((iface, i) => (
                          <div key={i} style={{ marginBottom: '12px', padding: '10px 12px', background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', border: `1px solid ${c.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span style={{ fontWeight: '700', fontSize: '14px', color: c.text }}>{iface.name}</span>
                              <span style={{ fontSize: '11px', color: c.textMuted }}>{iface.type}</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', padding: '1px 7px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', background: iface.up ? '#16a34a20' : '#dc262620', color: iface.up ? '#16a34a' : '#dc2626' }}>{iface.up ? 'UP' : 'DOWN'}</span>
                            </div>
                            {iface.mac && <Row label="MAC Address" value={iface.mac} />}
                            <Row label="MTU" value={String(iface.mtu)} />
                            {iface.addresses.length > 0 && (
                              <div style={{ marginTop: '6px' }}>
                                <div style={{ fontSize: '11px', color: c.textMuted, fontWeight: '500', marginBottom: '4px' }}>IP Addresses</div>
                                {iface.addresses.map((addr, j) => (
                                  <div key={j} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: '6px', padding: '3px 0', fontSize: '12px' }}>
                                    <span style={{ color: addr.family === 'inet' ? '#60a5fa' : '#a78bfa', fontFamily: '"Hack", "Courier New", monospace', fontWeight: '600' }}>{addr.family}</span>
                                    <span style={{ fontFamily: '"Hack", "Courier New", monospace', color: c.text }}>{addr.address}{iface.gateway && addr.family === 'inet' ? ` — Gateway: ${iface.gateway}` : ''}</span>
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
                    <span style={{ fontSize: '13px', fontWeight: '600', color: c.textMuted }}>Log Files</span>
                    <button onClick={fetchLogs} style={{ ...styles.btn, padding: '4px 8px', fontSize: '11px', ...styles.btnSecondary }} disabled={logsLoading}>↺</button>
                  </div>
                  {logsLoading && !selectedLog && <div style={{ fontSize: '13px', color: c.textMuted }}>Loading...</div>}
                  {availableLogs.map((log, i) => (
                    <div key={i} onClick={() => fetchLogContent(log.path)}
                      style={{ padding: '8px 10px', borderRadius: '6px', marginBottom: '4px', cursor: 'pointer', background: selectedLog === log.path ? c.primary : c.cardHover, color: selectedLog === log.path ? '#fff' : c.text, fontSize: '13px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: c.textMuted }}>Services</span>
                    <button onClick={fetchServices} style={{ ...styles.btn, padding: '4px 8px', fontSize: '11px', ...styles.btnSecondary }}>↺</button>
                  </div>
                  {servicesLoading && <div style={{ fontSize: '13px', color: c.textMuted }}>Loading...</div>}
                  {servicesList.map((svc, i) => (
                    <div key={i} onClick={() => fetchServiceDetail(svc)}
                      style={{ padding: '8px 10px', borderRadius: '6px', marginBottom: '4px', cursor: 'pointer', background: selectedService === svc ? c.primary : c.cardHover, color: selectedService === svc ? '#fff' : c.text, fontSize: '13px', fontFamily: '"Hack", "Courier New", monospace' }}>
                      {svc}
                    </div>
                  ))}
                </div>
                <div>
                  {serviceDetail && <div style={{ ...styles.sshTerminal, minHeight: '300px' }}>{serviceDetail}</div>}
                </div>
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
                          <tr key={i} style={{ borderBottom: `1px solid ${c.border}20` }}>
                            <td style={{ ...styles.td, fontFamily: '"Hack", "Courier New", monospace', fontWeight: '600' }}>{ct.name}</td>
                            <td style={{ ...styles.td, fontFamily: '"Hack", "Courier New", monospace', fontSize: '12px', color: c.textMuted }}>{ct.image}</td>
                            <td style={{ ...styles.td }}>
                              <span style={{ fontSize: '11px', padding: '2px 8px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', fontWeight: '700', background: ct.status?.startsWith('Up') ? '#16a34a20' : '#dc262620', color: ct.status?.startsWith('Up') ? '#16a34a' : '#dc2626' }}>{ct.status}</span>
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
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px', padding: '4px', background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>
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
                          padding: '7px 14px', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', border: 'none', cursor: 'pointer',
                          fontSize: '13px', fontWeight: isActive ? '600' : '500',
                          background: danger
                            ? (isActive ? '#991b1b' : isHover ? '#b91c1c' : '#ef444420')
                            : isUpgrade
                            ? (isActive ? '#15803d' : isHover ? '#16a34a' : '#22c55e20')
                            : (isActive ? c.primary : isHover ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : 'transparent'),
                          color: danger
                            ? (isActive || isHover ? '#fff' : '#ef4444')
                            : isUpgrade
                            ? (isActive || isHover ? '#fff' : '#22c55e')
                            : (isActive ? '#fff' : isHover ? c.text : c.textMuted),
                          transition: 'all 0.15s',
                          boxShadow: isActive ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
                        }}>
                        <span style={{ fontSize: '14px' }}>{icon}</span>
                        {isUpgrade && upgradeLoading ? 'Upgrading...' : label}
                      </button>
                    );
                  })}
                </div>
                {/* Running upgrade indicator */}
                {upgradeLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', background: darkMode ? 'rgba(61,214,140,0.06)' : 'rgba(34,168,106,0.06)', border: '1px solid #3dd68c40', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', marginBottom: '16px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3dd68c', animation: 'pulse 1s infinite', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#3dd68c', letterSpacing: '0.06em' }}>UPGRADE IN PROGRESS</div>
                      <div style={{ fontSize: '11px', color: c.textMuted, marginTop: '2px' }}>Installing packages — do not close this window</div>
                    </div>
                  </div>
                )}

                {/* Upgrade result */}
                {upgradeOutput && !upgradeLoading && (
                  <div style={{ background: darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)', border: `1px solid ${c.border}`, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: '8px', background: darkMode ? 'rgba(61,214,140,0.06)' : 'rgba(34,168,106,0.06)' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3dd68c' }} />
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#3dd68c', letterSpacing: '0.1em' }}>UPGRADE COMPLETE</span>
                    </div>
                    <pre style={{ margin: 0, padding: '14px 16px', background: 'transparent', color: c.text, fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '360px', overflow: 'auto' }}>{upgradeOutput}</pre>
                  </div>
                )}

                {/* Check updates result */}
                {!actionLoading && updatesData && activeAction === '__check_updates__' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Summary card */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                      {[
                        { label: 'PACKAGES AVAILABLE', value: updatesData.packages.length, color: updatesData.packages.length > 0 ? '#e8a838' : '#3dd68c' },
                        { label: 'REPOS FETCHED', value: updatesData.fetched, color: '#467885' },
                        { label: 'STATUS', value: updatesData.success ? 'OK' : 'ERROR', color: updatesData.success ? '#3dd68c' : '#f06060' },
                      ].map(s => (
                        <div key={s.label} style={{ padding: '14px 16px', background: darkMode ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', border: `1px solid ${s.color}30`, clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}>
                          <div style={{ fontSize: '9px', letterSpacing: '0.18em', color: c.textMuted, marginBottom: '6px' }}>{s.label}</div>
                          <div style={{ fontSize: '22px', fontWeight: '800', color: s.color }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                    {/* Package list */}
                    {updatesData.packages.length > 0 && (
                      <div style={{ border: `1px solid ${c.border}`, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', overflow: 'hidden' }}>
                        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${c.border}`, fontSize: '10px', letterSpacing: '0.15em', color: '#e8a838', background: darkMode ? 'rgba(232,168,56,0.06)' : 'rgba(232,168,56,0.04)' }}>
                          AVAILABLE UPDATES — {updatesData.packages.length} package{updatesData.packages.length !== 1 ? 's' : ''}
                        </div>
                        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                          {updatesData.packages.map((p, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 16px', borderBottom: `1px solid ${c.border}20`, background: i % 2 === 0 ? 'transparent' : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') }}>
                              <span style={{ fontSize: '12px', color: c.text, fontWeight: '600' }}>{p.name}</span>
                              <span style={{ fontSize: '11px', color: c.textMuted, fontFamily: '"Hack","Courier New",monospace' }}>{p.version}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {updatesData.packages.length === 0 && (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#3dd68c', fontSize: '13px', border: '1px solid #3dd68c30', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>
                        ✓ System is up to date
                      </div>
                    )}
                  </div>
                )}

                {actionLoading && <div style={{ padding: '20px', textAlign: 'center', color: c.textMuted, fontSize: '13px' }}>Running...</div>}
                {!actionLoading && actionOutput && !upgradeOutput && activeAction !== '__check_updates__' && <ActionOutput text={actionOutput} />}
              </div>
            )}

            {activeTab === 'network' && (
              <div>
                {/* Sub-tabs */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', padding: '4px', background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>
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
                          background: active ? c.primary : 'transparent', color: active ? '#fff' : c.textMuted,
                          clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                        <span style={{ fontSize: '13px' }}>{sub.icon}</span> {sub.label}
                      </button>
                    );
                  })}
                </div>

                {/* IP Info / Ports / Firewall */}
                {networkSubTab !== 'tools' && (
                  <div>
                    {networkInfoLoading && <div style={{ padding: '20px', textAlign: 'center', color: c.textMuted, fontSize: '13px' }}>Loading...</div>}
                    {!networkInfoLoading && networkInfoOutput && <pre style={{ margin: 0, padding: '16px', background: darkMode ? '#0a1218' : '#f0f5f8', border: `1px solid ${c.border}`, color: c.text, fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '500px', overflow: 'auto', fontFamily: '"Hack","Courier New",monospace', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>{networkInfoOutput}</pre>}
                    {!networkInfoLoading && !networkInfoOutput && (
                      <div style={{ padding: '20px', textAlign: 'center', color: c.textMuted, fontSize: '13px' }}>
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
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: c.textMuted }}>Tool</label>
                      <select value={networkTool} onChange={e => setNetworkTool(e.target.value)} style={{ ...styles.input, width: '100%', boxSizing: 'border-box', marginBottom: '12px' }}>
                        <option value="ping">Ping</option>
                        <option value="traceroute">Traceroute</option>
                        <option value="nslookup">NSLookup</option>
                      </select>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: c.textMuted }}>Target</label>
                      <input type="text" value={networkTarget} onChange={e => setNetworkTarget(e.target.value)} placeholder="8.8.8.8" style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <button onClick={runNetworkTool} style={{ ...styles.btn, ...styles.btnPrimary }} disabled={networkLoading}>Run</button>
                      {networkLoading && <button onClick={stopNetworkTool} style={{ ...styles.btn, ...styles.btnDanger }}>Stop</button>}
                    </div>
                    {networkOutput && <pre style={{ margin: 0, padding: '16px', background: darkMode ? '#0a1218' : '#f0f5f8', border: `1px solid ${c.border}`, color: c.text, fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '500px', overflow: 'auto', fontFamily: '"Hack","Courier New",monospace', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>{networkOutput}</pre>}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'agent' && (
              <div>
                {agentInfoLoading && <div style={{ padding: '20px', textAlign: 'center', color: c.textMuted, fontSize: '13px' }}>Loading agent info...</div>}
                {agentInfo && !agentInfo.error && (
                  <div>
                    {/* Agent Info Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                      {[
                        { label: 'VERSION', value: agentInfo.version || '?', color: '#A8987C' },
                        { label: 'UPTIME', value: agentInfo.uptime || '?', color: '#3dd68c' },
                        { label: 'PLATFORM', value: `${(agentInfo.os || '').toUpperCase()} / ${agentInfo.arch || ''}`, color: '#467885' },
                        { label: 'GO VERSION', value: agentInfo.go_version || '?', color: '#4888e8' },
                      ].map(card => (
                        <div key={card.label} style={{ padding: '16px 18px', background: darkMode ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', border: `1px solid ${card.color}30`, clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}>
                          <div style={{ fontSize: '9px', letterSpacing: '0.18em', color: c.textMuted, marginBottom: '6px' }}>{card.label}</div>
                          <div style={{ fontSize: '18px', fontWeight: '800', color: card.color }}>{card.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Agent Details Table */}
                    <div style={{ border: `1px solid ${c.border}`, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', overflow: 'hidden', marginBottom: '24px' }}>
                      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${c.border}`, fontSize: '10px', letterSpacing: '0.15em', color: '#A8987C', background: darkMode ? 'rgba(168,152,124,0.06)' : 'rgba(168,152,124,0.04)', fontWeight: '700' }}>
                        AGENT DETAILS
                      </div>
                      {[
                        { label: 'Binary Path', value: agentInfo.binary },
                        { label: 'Config Path', value: agentInfo.config },
                        { label: 'Server URL', value: agentInfo.server_url },
                        { label: 'Build Date', value: agentInfo.build_date },
                      ].map((row, i) => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${c.border}20`, background: i % 2 === 0 ? 'transparent' : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') }}>
                          <span style={{ fontSize: '12px', color: c.textMuted, fontWeight: '600' }}>{row.label}</span>
                          <span style={{ fontSize: '12px', color: c.text, fontFamily: '"Hack","Courier New",monospace' }}>{row.value || '—'}</span>
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
                        <button onClick={handleUninstallAgent} style={{ ...styles.btn, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', display: 'flex', alignItems: 'center', gap: '6px', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))' }}>
                          <span>🗑</span> Uninstall Agent
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {agentInfo?.error_detail && !agentInfo?.error && (
                  <div style={{ padding: '16px 20px', marginBottom: '16px', background: darkMode ? 'rgba(232,168,56,0.06)' : 'rgba(232,168,56,0.04)', border: '1px solid #e8a83840', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px' }}>⚠</span>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#e8a838', marginBottom: '2px' }}>Agent Update Required</div>
                      <div style={{ fontSize: '11px', color: c.textMuted }}>{agentInfo.error_detail}</div>
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
                  <div style={{ padding: '20px', textAlign: 'center', color: '#f06060', fontSize: '13px', border: '1px solid #f0606030', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>
                    Error: {agentInfo.error}
                  </div>
                )}
                {!agentInfoLoading && !agentInfo && (
                  <div style={{ padding: '20px', textAlign: 'center', color: c.textMuted, fontSize: '13px' }}>
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
          <div style={{ background: c.card, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, width: '100%', maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: '700', fontSize: '15px' }}>Bulk Action Progress</span>
                <span style={{ fontSize: '12px', color: c.textMuted }}>
                  {bulkProgress.filter(p=>p.status==='done').length}/{bulkProgress.length} done
                  {bulkProgress.some(p=>p.status==='error') && ` · ${bulkProgress.filter(p=>p.status==='error').length} error`}
                </span>
                {bulkActionLoading && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1s infinite' }} />}
              </div>
              <button onClick={() => setShowBulkModal(false)} style={{ ...styles.btn, padding: '4px 12px', fontSize: '13px', background: c.cardHover, border: `1px solid ${c.border}` }}>
                {bulkActionLoading ? 'Hide (running in background)' : 'Close'}
              </button>
            </div>
            {/* Progress list */}
            <div style={{ overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {bulkProgress.map(p => (
                <div key={p.id} style={{ background: darkMode ? '#0d1820' : '#f0f5f8', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', padding: '12px 14px', border: `1px solid ${c.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                        background: p.status === 'done' ? '#22c55e' : p.status === 'error' ? '#ef4444' : p.status === 'running' ? '#f59e0b' : c.border,
                        boxShadow: p.status === 'running' ? '0 0 6px #f59e0b80' : p.status === 'done' ? '0 0 4px #22c55e60' : 'none',
                        animation: p.status === 'running' ? 'pulse 1s infinite' : 'none',
                      }} />
                      <span style={{ fontWeight: '600', fontSize: '13px' }}>{p.name}</span>
                      <span style={{ fontSize: '11px', color: c.textMuted, fontFamily: '"Hack", "Courier New", monospace' }}>{p.host}</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em',
                      color: p.status === 'done' ? '#22c55e' : p.status === 'error' ? '#ef4444' : p.status === 'running' ? '#f59e0b' : c.textMuted,
                    }}>{p.status}</span>
                  </div>
                  <div style={{ height: '5px', borderRadius: '3px', background: darkMode ? '#1e293b' : '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '3px',
                      width: p.status === 'pending' ? '0%' : p.status === 'running' ? '60%' : '100%',
                      background: p.status === 'done' ? 'linear-gradient(90deg,#22c55e,#10b981)' : p.status === 'error' ? '#ef4444' : 'linear-gradient(90deg,#f59e0b,#fbbf24)',
                      transition: p.status !== 'running' ? 'width 0.5s ease' : 'none',
                      backgroundSize: p.status === 'running' ? '200% 100%' : '100% 100%',
                      animation: p.status === 'running' ? 'shimmer 1.5s linear infinite' : 'none',
                    }} />
                  </div>
                  {p.output && p.status !== 'pending' && (
                    <div style={{ marginTop: '8px', fontSize: '11px', color: c.textMuted, fontFamily: '"Hack", "Courier New", monospace', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto', background: darkMode ? '#020617' : '#f1f5f9', borderRadius: '4px', padding: '6px 8px', lineHeight: 1.5 }}>
                      {p.output.length > 800 ? p.output.slice(0, 800) + '\n…' : p.output}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Footer */}
            {!bulkActionLoading && (
              <div style={{ padding: '12px 20px', borderTop: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
                <button onClick={() => { setBulkProgress([]); setShowBulkModal(false); }} style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '13px' }}>Clear & Close</button>
                <button onClick={() => setShowBulkModal(false)} style={{ ...styles.btn, ...styles.btnPrimary, fontSize: '13px' }}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showToken && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: c.card, padding: '24px', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))', border: `1px solid ${c.border}`, zIndex: 1001, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Deploy Agent on {showToken.host}</h3>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Run this on the target server as root or with sudo:</div>
          <div style={{ background: '#0d1117', color: '#86efac', padding: '12px', borderRadius: '6px', fontFamily: '"Hack", "Courier New", monospace', fontSize: '12px', wordBreak: 'break-all', marginBottom: '4px', position: 'relative' }}>
            {showToken.installCmd || `curl -fsSL "..." | sudo sh`}
            {showToken.installCmd && <button onClick={() => copyToClipboard(showToken.installCmd)} style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px' }}>Copy</button>}
          </div>
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
            <div style={{ ...styles.modalContent, maxWidth: '560px', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, #16232E, #25515E)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: '700', color: '#fff' }}>Add New Host</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Step {wizardStep} of {steps.length} — {steps[wizardStep - 1]}</div>
                </div>
                <button onClick={closeWizard} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              {/* Progress bar */}
              <div style={{ display: 'flex', background: 'rgba(15,23,42,0.6)', borderBottom: `1px solid ${c.border}` }}>
                {steps.map((s, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', fontSize: '11px', fontWeight: i + 1 <= wizardStep ? '700' : '400', color: i + 1 < wizardStep ? c.success : i + 1 === wizardStep ? '#60a5fa' : c.textMuted, borderBottom: i + 1 === wizardStep ? '2px solid #60a5fa' : i + 1 < wizardStep ? `2px solid ${c.success}` : '2px solid transparent', transition: 'all 0.2s' }}>
                    <div style={{ fontSize: '15px', marginBottom: '1px' }}>{i + 1 < wizardStep ? '✓' : i + 1}</div>
                    {s}
                  </div>
                ))}
              </div>
              {/* Body */}
              <div style={{ padding: '28px 28px 24px', background: c.card }}>
                {/* Step 1: Choose OS */}
                {wizardStep === 1 && (
                  <div>
                    <div style={{ fontSize: '14px', color: c.textMuted, marginBottom: '20px' }}>Select the operating system of the host you want to add.</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {osOptions.map(os => (
                        <div key={os.id} onClick={() => !os.disabled && setWizardOS(os.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 18px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', border: `2px solid ${wizardOS === os.id ? '#3b82f6' : c.border}`, background: wizardOS === os.id ? 'rgba(59,130,246,0.08)' : 'rgba(30,41,59,0.4)', cursor: os.disabled ? 'not-allowed' : 'pointer', opacity: os.disabled ? 0.45 : 1, transition: 'all 0.15s' }}>
                          <div style={{ fontSize: '32px' }}>{os.icon}</div>
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '15px', color: c.text }}>{os.label}</div>
                            <div style={{ fontSize: '12px', color: c.textMuted, marginTop: '2px' }}>{os.desc}</div>
                          </div>
                          <div style={{ marginLeft: 'auto' }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${wizardOS === os.id ? '#3b82f6' : c.border}`, background: wizardOS === os.id ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                    <div style={{ fontSize: '14px', color: c.textMuted, marginBottom: '20px' }}>Enter the IP address of the server. Hostname and OS will be detected automatically when the agent connects.</div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={styles.label}>IP Address</label>
                      <input autoFocus type="text" value={wizardHost} onChange={e => setWizardHost(e.target.value)}
                        placeholder="e.g. 192.168.1.201"
                        style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }}
                        onKeyDown={e => e.key === 'Enter' && wizardHost && document.querySelector('[data-wizard-next]')?.click()} />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={styles.label}>Friendly Name <span style={{ color: c.textMuted, fontWeight: 400 }}>(optional — auto-detected from hostname)</span></label>
                      <input type="text" value={wizardName} onChange={e => setWizardName(e.target.value)}
                        placeholder="e.g. web-server-01"
                        style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }}
                        onKeyDown={e => e.key === 'Enter' && wizardHost && document.querySelector('[data-wizard-next]')?.click()} />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={styles.label}>Group <span style={{ color: c.textMuted, fontWeight: 400 }}>(optional)</span></label>
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
                      <div style={{ fontSize: '14px', color: c.textMuted, marginBottom: '16px' }}>
                        {wizardOS === 'windows'
                          ? <>Run this command on <strong style={{ color: c.text }}>{wizardName || 'your server'}</strong> in <strong style={{ color: '#60a5fa' }}>PowerShell as Administrator</strong>:</>
                          : <>Run this command on <strong style={{ color: c.text }}>{wizardName || 'your server'}</strong> as root or with sudo:</>}
                      </div>
                      {wizardOS === 'windows' && (
                        <div style={{ marginBottom: '10px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', fontSize: '12px', color: '#60a5fa' }}>
                          ⊞ PowerShell — Run as Administrator (right-click → Run as Administrator)
                        </div>
                      )}
                      <div style={{ background: 'rgba(0,0,0,0.35)', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', padding: '14px 16px', fontFamily: '"Hack", "Courier New", monospace', fontSize: '12px', color: '#86efac', wordBreak: 'break-all', position: 'relative', border: '1px solid rgba(34,197,94,0.2)', minHeight: '52px' }}>
                        {wizardInstallCmdLoading ? <span style={{ color: '#60a5fa' }}>Loading...</span> : wizardInstallCmd}
                        {wizardInstallCmd && (
                          <button onClick={() => copyToClipboard(wizardInstallCmd)}
                            style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', borderRadius: '5px', padding: '3px 10px', fontSize: '11px', cursor: 'pointer' }}>
                            Copy
                          </button>
                        )}
                      </div>
                      <div style={{ marginTop: '12px', fontSize: '12px', color: c.textMuted }}>
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
                        <div style={{ fontSize: '16px', fontWeight: '600', color: c.text, marginBottom: '8px' }}>Waiting for connection...</div>
                        <div style={{ fontSize: '13px', color: c.textMuted, marginBottom: '20px' }}>Run the command from the previous step on <strong style={{ color: c.text }}>{wizardName || 'your server'}</strong>. The dashboard will update automatically.</div>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '24px' }}>
                          {[0,1,2].map(i => (
                            <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }} />
                          ))}
                        </div>
                        <button onClick={() => setWizardStep(3)} style={{ ...styles.btn, ...styles.btnSecondary, fontSize: '12px' }}>← Back to command</button>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '52px', marginBottom: '12px' }}>✓</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: c.success, marginBottom: '8px' }}>Connected!</div>
                        <div style={{ fontSize: '13px', color: c.textMuted, marginBottom: '4px' }}>
                          <strong style={{ color: c.text }}>{wizardNewServer?.name || wizardName}</strong> is now online
                        </div>
                        {wizardNewServer?.host && <div style={{ fontSize: '12px', color: c.textMuted, marginBottom: '24px' }}>{wizardNewServer.host}</div>}
                        <button onClick={() => { closeWizard(); fetchServers(); setNavSection('servers'); }}
                          style={{ ...styles.btn, ...styles.btnPrimary }}>Go to Dashboard</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showScan && (
        <div style={styles.modal} onClick={() => setShowScan(false)}>
          <div style={{ ...styles.modalContent, maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
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
              {scanStatus && <div style={{ marginBottom: '16px', color: c.textMuted }}>{scanStatus}</div>}
              {foundServers.length > 0 && (
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '12px' }}>Found {foundServers.length} servers:</div>
                  {foundServers.map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: c.cardHover, borderRadius: '6px', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: '500' }}>{String(s.host || '')}</div>
                        {s.hostname && <div style={{ fontSize: '12px', color: c.textMuted }}>{String(s.hostname)}</div>}
                      </div>
                      <button onClick={() => addScannedServer(s)} style={{ ...styles.btn, ...styles.btnPrimary, padding: '6px 12px', fontSize: '12px' }}>Add</button>
                    </div>
                  ))}
                  <button onClick={addAllScanned} style={{ ...styles.btn, ...styles.btnSuccess, width: '100%', marginTop: '12px' }}>Add All</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reboot Confirmation Modal */}
      {showRebootConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: c.card, borderRadius: '16px', border: `1px solid ${c.border}`, width: '100%', maxWidth: '460px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', background: '#ef444420', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>↺</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '15px' }}>Odaberi servere za reboot</div>
                <div style={{ fontSize: '12px', color: c.textMuted, marginTop: '2px' }}>Odznači servere koje ne želiš restartovati</div>
              </div>
              {/* Select all / none */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setRebootSelected(new Set(rebootTargets.map(s => s.id)))}
                  style={{ fontSize: '11px', color: c.primary, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Sve</button>
                <span style={{ color: c.border }}>|</span>
                <button onClick={() => setRebootSelected(new Set())}
                  style={{ fontSize: '11px', color: c.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Ništa</button>
              </div>
            </div>
            {/* Server list with checkboxes */}
            <div style={{ padding: '8px 24px', maxHeight: '280px', overflowY: 'auto' }}>
              {rebootTargets.map(s => {
                const checked = rebootSelected.has(s.id);
                return (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: `1px solid ${c.border}20`, cursor: 'pointer' }}>
                    <input type="checkbox" checked={checked}
                      onChange={() => setRebootSelected(prev => {
                        const next = new Set(prev);
                        next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                        return next;
                      })}
                      style={{ width: '16px', height: '16px', accentColor: '#ef4444', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: checked ? c.text : c.textMuted }}>{s.name}</div>
                      <div style={{ fontSize: '11px', color: c.textMuted, fontFamily: '"Hack", "Courier New", monospace' }}>{s.host}</div>
                    </div>
                    <span style={{ fontSize: '11px', background: checked ? '#ef444420' : c.cardHover, color: checked ? '#ef4444' : c.textMuted, padding: '2px 8px', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', fontWeight: '600' }}>
                      {checked ? 'reboot' : 'preskoči'}
                    </span>
                  </label>
                );
              })}
            </div>
            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${c.border}`, display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: c.textMuted }}>{rebootSelected.size} od {rebootTargets.length} selektovano</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowRebootConfirm(false)} style={{ ...styles.btn, ...styles.btnSecondary, padding: '8px 20px' }}>Otkaži</button>
                <button onClick={executeReboot} disabled={rebootSelected.size === 0}
                  style={{ background: '#ef4444', color: '#fff', border: 'none', clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))', padding: '8px 20px', fontWeight: '600', cursor: rebootSelected.size === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: rebootSelected.size === 0 ? 0.4 : 1 }}>
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
          <div style={{ background: darkMode ? '#1e293b' : '#fff', borderRadius: '20px', padding: '36px 40px', maxWidth: '420px', width: '90%', boxShadow: '0 24px 80px rgba(0,0,0,0.4)', textAlign: 'center', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>☕</div>
            <div style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px', background: 'linear-gradient(135deg, #A8987C, #467885)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: 'none' }}>Enjoying ServerCTL?</div>
            <div style={{ fontSize: '14px', color: darkMode ? '#94a3b8' : '#64748b', lineHeight: 1.7, marginBottom: '28px' }}>
              ServerCTL is free and open-source. If it saves you time and makes your life easier, consider buying me a coffee — it helps keep the project alive and growing.
            </div>
            <a href="https://buymeacoffee.com/vilic355" target="_blank" rel="noreferrer"
              style={{ display: 'block', background: '#FFDD00', color: '#000', fontWeight: '800', fontSize: '15px', padding: '13px 24px', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', textDecoration: 'none', marginBottom: '12px', transition: 'transform 0.15s, filter 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
              onMouseLeave={e => e.currentTarget.style.filter = ''}>
              ☕ Buy me a coffee
            </a>
            <button onClick={() => { localStorage.setItem('serverctl_donated', 'true'); setShowDonationModal(false); }}
              style={{ display: 'block', width: '100%', background: darkMode ? '#0f172a' : '#f1f5f9', color: darkMode ? '#94a3b8' : '#475569', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', padding: '11px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginBottom: '8px' }}>
              I've donated — don't show again
            </button>
            <button onClick={() => setShowDonationModal(false)}
              style={{ background: 'none', border: 'none', color: darkMode ? '#475569' : '#94a3b8', fontSize: '12px', cursor: 'pointer', padding: '4px' }}>
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Global Task Progress Panel */}
      {globalTasks.length > 0 && (
        <div style={{ position: 'fixed', bottom: '24px', left: '224px', zIndex: 9998, width: '360px', background: darkMode ? '#0f1a24' : '#fff', border: `1px solid ${darkMode ? '#1e3d4f' : '#c0d4da'}`, borderRadius: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${darkMode ? '#1e3d4f' : '#c0d4da'}`, background: darkMode ? '#0d1820' : '#e6eef2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {globalTasks.some(t => t.status === 'running') && (
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3dd68c', animation: 'pulse 1s infinite', flexShrink: 0 }} />
              )}
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#A8987C', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Tasks {globalTasks.filter(t => t.status === 'running').length > 0 && `(${globalTasks.filter(t => t.status === 'running').length} running)`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {globalTasks.some(t => t.status !== 'running') && (
                <button onClick={clearFinishedTasks} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: '10px', padding: '2px 6px' }}>Clear</button>
              )}
              <button onClick={() => setGlobalTasks([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
            </div>
          </div>
          {/* Task list */}
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {globalTasks.slice().reverse().map(task => {
              const elapsed = Math.round((Date.now() - task.startTime) / 1000);
              const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
              return (
                <div key={task.id} style={{ display: 'flex', gap: '10px', padding: '10px 14px', borderBottom: `1px solid ${darkMode ? '#1e3d4f20' : '#e2e8f020'}`, alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0, marginTop: '2px' }}>
                    {task.status === 'running' && <div style={{ width: '14px', height: '14px', border: '2px solid #A8987C40', borderTopColor: '#A8987C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                    {task.status === 'done' && <span style={{ color: '#3dd68c', fontSize: '14px' }}>✓</span>}
                    {task.status === 'error' && <span style={{ color: '#f06060', fontSize: '14px' }}>✗</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: c.text }}>{task.label}</span>
                      <span style={{ fontSize: '10px', color: c.textMuted }}>{elapsedStr}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: c.textMuted, marginBottom: task.status === 'running' ? '6px' : '0' }}>{task.server}</div>
                    {task.status === 'running' && (
                      <div style={{ height: '3px', background: darkMode ? '#1e3d4f' : '#c0d4da', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#A8987C', borderRadius: '2px', animation: 'progressIndeterminate 1.5s ease-in-out infinite', width: '40%' }} />
                      </div>
                    )}
                    {task.output && task.status !== 'running' && (
                      <div style={{ fontSize: '10px', color: task.status === 'error' ? '#f06060' : '#3dd68c', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.output}</div>
                    )}
                  </div>
                  <button onClick={() => removeTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: '12px', padding: 0, flexShrink: 0, opacity: 0.5 }}>×</button>
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
            <div key={t.id} style={{ background: darkMode ? '#1e293b' : '#fff', border: `1px solid ${t.type === 'error' ? '#ef444440' : '#22c55e40'}`, borderLeft: `4px solid ${t.type === 'error' ? '#ef4444' : '#22c55e'}`, clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))', padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', gap: '12px', alignItems: 'flex-start', animation: 'slideIn 0.2s ease' }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{t.type === 'error' ? '⚠️' : '✅'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: t.type === 'error' ? '#ef4444' : '#22c55e', marginBottom: '3px' }}>{t.title}</div>
                <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', lineHeight: 1.4 }}>{t.message}</div>
              </div>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: darkMode ? '#475569' : '#94a3b8', fontSize: '16px', padding: 0, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default Dashboard;
