package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"gopkg.in/yaml.v3"
)

// ─── Config ──────────────────────────────────────────────────────────────────

type Config struct {
	ServerURL string `yaml:"server_url"`
	Token     string `yaml:"token"`
	Interval  int    `yaml:"interval"` // seconds between metric pushes
}

var defaultConfigPaths = []string{
	"/etc/serverctl-agent/config.yaml",
	"/etc/serverctl-agent/config.yml",
}

func loadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	if cfg.Interval <= 0 {
		cfg.Interval = 30
	}
	return &cfg, nil
}

func findConfig(override string) (*Config, string, error) {
	if override != "" {
		cfg, err := loadConfig(override)
		return cfg, override, err
	}
	// Windows: look next to exe
	if runtime.GOOS == "windows" {
		exe, _ := os.Executable()
		candidate := filepath.Join(filepath.Dir(exe), "config.yaml")
		if _, err := os.Stat(candidate); err == nil {
			cfg, err := loadConfig(candidate)
			return cfg, candidate, err
		}
	}
	for _, p := range defaultConfigPaths {
		if _, err := os.Stat(p); err == nil {
			cfg, err := loadConfig(p)
			return cfg, p, err
		}
	}
	return nil, "", fmt.Errorf("no config file found; tried %v", defaultConfigPaths)
}

// ─── Package manager detection ───────────────────────────────────────────────

type pkgManager struct {
	name    string
	update  []string // refresh cache
	list    []string // list upgradable
	upgrade []string // full upgrade
}

func which(bin string) bool {
	_, err := exec.LookPath(bin)
	return err == nil
}

func detectPkgMgr() *pkgManager {
	switch {
	case which("apt-get"):
		return &pkgManager{
			name:    "apt",
			update:  []string{"apt-get", "update", "-q"},
			list:    []string{"apt", "list", "--upgradable", "--quiet", "2>/dev/null"},
			upgrade: []string{"apt-get", "upgrade", "-y"},
		}
	case which("dnf"):
		return &pkgManager{
			name:    "dnf",
			update:  []string{"dnf", "check-update", "--quiet"},
			list:    []string{"dnf", "list", "updates", "--quiet"},
			upgrade: []string{"dnf", "upgrade", "-y"},
		}
	case which("yum"):
		return &pkgManager{
			name:    "yum",
			update:  []string{"yum", "check-update", "--quiet"},
			list:    []string{"yum", "list", "updates", "--quiet"},
			upgrade: []string{"yum", "update", "-y"},
		}
	case which("zypper"):
		return &pkgManager{
			name:    "zypper",
			update:  []string{"zypper", "refresh", "--quiet"},
			list:    []string{"zypper", "list-updates", "--quiet"},
			upgrade: []string{"zypper", "update", "-y"},
		}
	default:
		return nil
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func runCmd(args ...string) (string, int, error) {
	cmd := exec.Command(args[0], args[1:]...)
	var out bytes.Buffer
	var errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut
	err := cmd.Run()
	code := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			code = exitErr.ExitCode()
		} else {
			return "", -1, err
		}
	}
	combined := out.String()
	if combined == "" {
		combined = errOut.String()
	}
	return combined, code, nil
}

func runShell(command string) (string, error) {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/C", command)
	} else {
		cmd = exec.Command("bash", "-c", command)
	}
	var out bytes.Buffer
	var errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut
	err := cmd.Run()
	result := out.String() + errOut.String()
	return strings.TrimSpace(result), err
}

func localIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return "unknown"
	}
	defer conn.Close()
	return conn.LocalAddr().(*net.UDPAddr).IP.String()
}

func hostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return h
}

// ─── Update / reboot helpers ─────────────────────────────────────────────────

func countUpgradable(pm *pkgManager) int {
	if pm == nil {
		return 0
	}
	var out string
	if pm.name == "apt" {
		out, _ = runShell("apt list --upgradable --quiet 2>/dev/null")
	} else {
		out, _, _ = runCmd(pm.list...)
	}
	return parseUpgradableCount(out, pm.name)
}

func parseUpgradableCount(output, pmName string) int {
	count := 0
	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "WARNING") || strings.HasPrefix(line, "Listing...") {
			continue
		}
		switch pmName {
		case "apt":
			if strings.Contains(line, "/") && strings.Contains(line, "[upgradable") {
				count++
			}
		case "dnf", "yum":
			fields := strings.Fields(line)
			if len(fields) >= 3 && !strings.HasPrefix(line, "Last") && !strings.HasPrefix(line, "Obsoleting") {
				count++
			}
		case "zypper":
			if strings.HasPrefix(line, "|") || strings.HasPrefix(line, "v") {
				count++
			}
		}
	}
	return count
}

func rebootRequired() bool {
	if runtime.GOOS == "windows" {
		return false
	}
	// Debian/Ubuntu
	if _, err := os.Stat("/var/run/reboot-required"); err == nil {
		return true
	}
	// RHEL/CentOS/Fedora
	if which("needs-restarting") {
		_, code, err := runCmd("needs-restarting", "-r")
		if err == nil && code == 1 {
			return true
		}
	}
	return false
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

type Metrics struct {
	CPUPercent      float64 `json:"cpu_percent"`
	RamPercent      float64 `json:"ram_percent"`
	RamUsedGB       float64 `json:"ram_used_gb"`
	RamTotalGB      float64 `json:"ram_total_gb"`
	DiskPercent     float64 `json:"disk_percent"`
	DiskUsedGB      float64 `json:"disk_used_gb"`
	DiskTotalGB     float64 `json:"disk_total_gb"`
	Uptime          uint64  `json:"uptime"`
	Hostname        string  `json:"hostname"`
	IP              string  `json:"ip"`
	OS              string  `json:"os"`
	KernelVersion   string  `json:"kernel_version"`
	UpgradableCount int     `json:"upgradable_count"`
	RebootRequired  bool    `json:"reboot_required"`
}

func collectMetrics(upgradable int, reboot bool) (*Metrics, error) {
	cpuPct, err := cpu.Percent(500*time.Millisecond, false)
	if err != nil || len(cpuPct) == 0 {
		cpuPct = []float64{0}
	}

	memStat, err := mem.VirtualMemory()
	if err != nil {
		memStat = &mem.VirtualMemoryStat{}
	}

	diskStat, err := disk.Usage("/")
	if err != nil {
		diskStat = &disk.UsageStat{}
	}

	hostStat, err := host.Info()
	if err != nil {
		hostStat = &host.InfoStat{}
	}

	return &Metrics{
		CPUPercent:      round2(cpuPct[0]),
		RamPercent:      round2(memStat.UsedPercent),
		RamUsedGB:       round2(float64(memStat.Used) / 1e9),
		RamTotalGB:      round2(float64(memStat.Total) / 1e9),
		DiskPercent:     round2(diskStat.UsedPercent),
		DiskUsedGB:      round2(float64(diskStat.Used) / 1e9),
		DiskTotalGB:     round2(float64(diskStat.Total) / 1e9),
		Uptime:          hostStat.Uptime,
		Hostname:        hostname(),
		IP:              localIP(),
		OS:              hostStat.Platform + " " + hostStat.PlatformVersion,
		KernelVersion:   hostStat.KernelVersion,
		UpgradableCount: upgradable,
		RebootRequired:  reboot,
	}, nil
}

func round2(f float64) float64 {
	return float64(int(f*100)) / 100
}

// ─── Command handler ──────────────────────────────────────────────────────────

type IncomingMsg struct {
	Type      string `json:"type"`
	Command   string `json:"command"`
	RequestID string `json:"request_id"`
	Target    string `json:"target"`
}

type ResultMsg struct {
	Type      string                 `json:"type"`
	RequestID string                 `json:"request_id"`
	Result    map[string]interface{} `json:"result"`
}

type PendingUpdates struct {
	Count          int      `json:"count"`
	Packages       []string `json:"packages"`
	RebootRequired bool     `json:"reboot_required"`
}

type ReportMsg struct {
	Type           string          `json:"type"`
	Metrics        *Metrics        `json:"metrics,omitempty"`
	PendingUpdates *PendingUpdates `json:"pending_updates,omitempty"`
}

func handleCommand(command, target string, pm *pkgManager, cfg *Config) string {
	switch command {
	case "check_reboot":
		if rebootRequired() {
			return "1"
		}
		return "0"

	case "upgradable_packages":
		if pm == nil {
			return "0"
		}
		return strconv.Itoa(countUpgradable(pm))

	case "system_info":
		if runtime.GOOS == "windows" {
			out, _ := runShell("systeminfo")
			return out
		}
		out, _ := runShell("echo '=== OS ===' && cat /etc/os-release 2>/dev/null && echo '' && echo '=== Kernel ===' && uname -a && echo '' && echo '=== Uptime ===' && uptime && echo '' && echo '=== Memory ===' && free -h && echo '' && echo '=== Disk ===' && df -h && echo '' && echo '=== CPU ===' && lscpu 2>/dev/null | head -20 || cat /proc/cpuinfo | head -20")
		return out

	case "disk_usage":
		if runtime.GOOS == "windows" {
			out, _ := runShell("wmic logicaldisk get size,freespace,caption /format:list")
			return out
		}
		out, _ := runShell("df -h")
		return out

	case "memory":
		if runtime.GOOS == "windows" {
			out, _ := runShell("systeminfo | findstr Memory")
			return out
		}
		out, _ := runShell("free -h")
		return out

	case "netstat":
		if runtime.GOOS == "windows" {
			out, _ := runShell("ipconfig /all & echo. & echo ===== LISTENING PORTS ===== & netstat -an | findstr LISTENING & echo. & echo ===== FIREWALL STATUS ===== & netsh advfirewall show allprofiles state")
			return out
		}
		var sb strings.Builder
		sb.WriteString("══════════════════════════════════════════\n")
		sb.WriteString("  IP CONFIGURATION\n")
		sb.WriteString("══════════════════════════════════════════\n")
		ipOut, _ := runShell("ip -br addr show 2>/dev/null || ip addr show 2>/dev/null || ifconfig 2>/dev/null")
		sb.WriteString(ipOut)
		sb.WriteString("\n")
		gw, _ := runShell("ip route show default 2>/dev/null")
		if strings.TrimSpace(gw) != "" {
			sb.WriteString("\nDefault Gateway: " + strings.TrimSpace(gw) + "\n")
		}
		dns, _ := runShell("grep -v '^#' /etc/resolv.conf 2>/dev/null | grep nameserver")
		if strings.TrimSpace(dns) != "" {
			sb.WriteString("\nDNS Servers:\n" + dns + "\n")
		}
		sb.WriteString("\n══════════════════════════════════════════\n")
		sb.WriteString("  LISTENING PORTS\n")
		sb.WriteString("══════════════════════════════════════════\n")
		ports, _ := runShell("ss -tulnp 2>/dev/null || netstat -tulnp 2>/dev/null")
		sb.WriteString(ports)
		sb.WriteString("\n══════════════════════════════════════════\n")
		sb.WriteString("  FIREWALL STATUS\n")
		sb.WriteString("══════════════════════════════════════════\n")
		ufwOut, _ := runShell("ufw status 2>/dev/null")
		if strings.Contains(ufwOut, "Status:") {
			sb.WriteString(ufwOut)
		} else {
			fwdOut, _ := runShell("firewall-cmd --state 2>/dev/null && firewall-cmd --list-all 2>/dev/null")
			if strings.TrimSpace(fwdOut) != "" && !strings.Contains(fwdOut, "not running") {
				sb.WriteString(fwdOut)
			} else {
				iptOut, _ := runShell("iptables -L -n --line-numbers 2>/dev/null")
				if strings.TrimSpace(iptOut) != "" && !strings.Contains(iptOut, "Permission denied") && !strings.Contains(iptOut, "not found") {
					sb.WriteString(iptOut)
				} else {
					sb.WriteString("No firewall detected (ufw/firewalld/iptables not active or not installed)\n")
				}
			}
		}
		return sb.String()

	case "cpu_info":
		if runtime.GOOS == "windows" {
			out, _ := runShell("wmic cpu get Name,NumberOfCores,MaxClockSpeed /format:list")
			return out
		}
		out, _ := runShell("lscpu 2>/dev/null || cat /proc/cpuinfo")
		return out

	case "top_processes":
		if runtime.GOOS == "windows" {
			out, _ := runShell("tasklist /fo csv")
			return out
		}
		out, _ := runShell("ps aux --sort=-%cpu 2>/dev/null || ps aux")
		return out

	case "list_services":
		out, _ := runShell(listServicesCmd())
		return out

	case "service_status":
		svc := target
		if svc == "" {
			return "no service specified"
		}
		out, _ := runShell(serviceCmd("status", svc))
		return out

	case "list_logs":
		return listLogFiles()

	case "view_log":
		if target == "" {
			return "no path specified"
		}
		return readLogFile(target)

	case "update":
		if pm == nil {
			return "No package manager found"
		}
		out, _, _ := runCmd(pm.update...)
		return out

	case "upgrade":
		if pm == nil {
			return "No package manager found"
		}
		runCmd(pm.update...) //nolint:errcheck
		out, _ := runShell(strings.Join(pm.upgrade, " "))
		return out

	case "update_packages":
		if pm == nil {
			return "No package manager found"
		}
		runCmd(pm.update...)
		out, _ := runShell(strings.Join(pm.upgrade, " "))
		return out

	case "docker_ps":
		out, _ := runShell("docker ps --format 'table {{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}' 2>/dev/null || echo 'docker not available'")
		return out

	case "kill_process":
		if target == "" {
			return "no PID specified"
		}
		out, _ := runShell("kill -9 " + target)
		if out == "" {
			return "killed"
		}
		return out

	case "repo_speedtest":
		return repoSpeedTest()

	case "reboot":
		if runtime.GOOS == "windows" {
			out, _ := runShell("shutdown /r /t 5 /c \"ServerCTL reboot\"")
			return "Rebooting in 5 seconds...\n" + out
		}
		out, _ := runShell("sudo reboot || reboot || shutdown -r now")
		return "Reboot initiated.\n" + out

	case "update_agent":
		return updateAgent(cfg)

	case "sysinfo_json":
		return sysInfoJSON()

	case "df":
		out, _ := runShell("df -h")
		return out

	case "free":
		out, _ := runShell("free -h")
		return out

	case "uptime":
		out, _ := runShell("uptime")
		return out

	case "who":
		out, _ := runShell("who")
		return out

	default:
		if strings.HasPrefix(command, "shell:") {
			out, _ := runShell(strings.TrimPrefix(command, "shell:"))
			return out
		}
		if strings.HasPrefix(command, "service:") {
			parts := strings.SplitN(command, ":", 3)
			if len(parts) == 3 {
				action, svc := parts[1], parts[2]
				out, _ := runShell(serviceCmd(action, svc))
				return out
			}
		}
		return "unknown command: " + command
	}
}

func listLogFiles() string {
	dirs := []string{"/var/log"}
	var files []map[string]interface{}
	for _, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			name := e.Name()
			if strings.HasSuffix(name, ".log") || strings.HasSuffix(name, ".log.1") ||
				name == "syslog" || name == "auth.log" || name == "kern.log" ||
				name == "messages" || name == "dmesg" {
				info, _ := e.Info()
				size := int64(0)
				if info != nil {
					size = info.Size()
				}
				files = append(files, map[string]interface{}{
					"name": name,
					"path": dir + "/" + name,
					"size": size,
				})
			}
		}
	}
	if files == nil {
		files = []map[string]interface{}{}
	}
	data, _ := json.Marshal(files)
	return string(data)
}

func readLogFile(path string) string {
	// Only allow reading from /var/log for safety
	if !strings.HasPrefix(path, "/var/log/") {
		return "access denied: only /var/log/* allowed"
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "error reading file: " + err.Error()
	}
	// Return last 500 lines
	lines := strings.Split(string(data), "\n")
	if len(lines) > 500 {
		lines = lines[len(lines)-500:]
	}
	return strings.Join(lines, "\n")
}

func updateAgent(cfg *Config) string {
	// Determine platform
	platform := runtime.GOOS + "-" + runtime.GOARCH
	// Build download URL from server_url
	baseURL := strings.TrimRight(cfg.ServerURL, "/")
	// Replace ws:// with http://
	baseURL = strings.Replace(baseURL, "ws://", "http://", 1)
	baseURL = strings.Replace(baseURL, "wss://", "https://", 1)
	dlURL := baseURL + "/api/agent/download/" + platform

	if runtime.GOOS == "windows" {
		// Windows: download to temp, stop service, replace, start service
		script := fmt.Sprintf(`
$ErrorActionPreference = 'Stop'
$dlUrl = '%s'
$binPath = (Get-Process -Id $PID).Path
if (-not $binPath) { $binPath = 'C:\serverctl-agent\serverctl-agent.exe' }
$tmpPath = "$binPath.new"
Write-Output "[*] Downloading update from $dlUrl ..."
Invoke-WebRequest -Uri $dlUrl -OutFile $tmpPath -UseBasicParsing
Write-Output "[*] Stopping service..."
Stop-Service serverctl-agent -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Move-Item -Force $tmpPath $binPath
Write-Output "[*] Starting service..."
Start-Service serverctl-agent
Write-Output "[OK] Agent updated successfully."
`, dlURL)
		out, _ := runShell("powershell -Command \"" + strings.ReplaceAll(script, "\"", "\\\"") + "\"")
		return out
	}

	// Linux: download new binary, replace, restart service
	exePath, err := os.Executable()
	if err != nil {
		exePath = "/usr/local/bin/serverctl-agent"
	}

	cmds := fmt.Sprintf(
		`echo "[*] Downloading update from %s ..." && `+
			`curl -sL -o "%s.new" "%s" && `+
			`chmod +x "%s.new" && `+
			`echo "[*] Stopping service..." && `+
			`(systemctl stop serverctl-agent 2>/dev/null || true) && `+
			`mv -f "%s.new" "%s" && `+
			`echo "[*] Starting service..." && `+
			`(systemctl start serverctl-agent 2>/dev/null || nohup "%s" &) && `+
			`echo "[OK] Agent updated successfully."`,
		dlURL, exePath, dlURL, exePath, exePath, exePath, exePath)

	out, _ := runShell(cmds)
	return out
}

func repoSpeedTest() string {
	repos := []struct{ name, url string }{
		{"Ubuntu Archive", "http://archive.ubuntu.com/ubuntu/dists/noble/Release"},
		{"Ubuntu Security", "http://security.ubuntu.com/ubuntu/dists/noble-security/Release"},
		{"Ubuntu Updates", "http://archive.ubuntu.com/ubuntu/dists/noble-updates/Release"},
	}
	var lines []string
	lines = append(lines, "[From agent]")
	client := &http.Client{Timeout: 10 * time.Second}
	for _, r := range repos {
		start := time.Now()
		resp, err := client.Get(r.url)
		if err != nil {
			lines = append(lines, fmt.Sprintf("%s: Error — %v", r.name, err))
			continue
		}
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
		resp.Body.Close()
		elapsed := time.Since(start).Seconds()
		speed := float64(len(data)) / elapsed / 1024 / 1024 * 8
		lines = append(lines, fmt.Sprintf("%s: %.2f Mbps  (%d KB in %.2fs)", r.name, speed, len(data)/1024, elapsed))
	}
	return strings.Join(lines, "\n")
}

func sysInfoJSON() string {
	hostStat, _ := host.Info()
	cpuStat, _ := cpu.Info()
	memStat, _ := mem.VirtualMemory()
	swapStat, _ := mem.SwapMemory()

	cpuModel := ""
	cpuCores := 0
	cpuCoresPhysical := 0
	if len(cpuStat) > 0 {
		cpuModel = cpuStat[0].ModelName
		cpuCores = int(cpuStat[0].Cores)
	}
	cpuCoresPhysical = runtime.NumCPU()

	// Uptime as human-readable string
	uptimeStr := ""
	if hostStat != nil && hostStat.Uptime > 0 {
		u := hostStat.Uptime
		days := u / 86400
		hours := (u % 86400) / 3600
		mins := (u % 3600) / 60
		if days > 0 {
			uptimeStr = fmt.Sprintf("%dd %dh %dm", days, hours, mins)
		} else if hours > 0 {
			uptimeStr = fmt.Sprintf("%dh %dm", hours, mins)
		} else {
			uptimeStr = fmt.Sprintf("%dm", mins)
		}
	}

	// Load average
	loadAvg := ""
	if runtime.GOOS != "windows" {
		if la, err := os.ReadFile("/proc/loadavg"); err == nil {
			parts := strings.Fields(string(la))
			if len(parts) >= 3 {
				loadAvg = strings.Join(parts[:3], " ")
			}
		}
	}

	// SELinux
	selinux := "Disabled"
	if runtime.GOOS != "windows" {
		if out, err := runShell("getenforce 2>/dev/null"); err == nil && strings.TrimSpace(out) != "" {
			selinux = strings.TrimSpace(out)
		}
	}

	// Kernel info
	kernelRunning := ""
	if hostStat != nil {
		kernelRunning = hostStat.KernelVersion
	}

	// Disks
	var disks []map[string]interface{}
	partitions, _ := disk.Partitions(false)
	seen := map[string]bool{}
	for _, p := range partitions {
		if seen[p.Mountpoint] {
			continue
		}
		// Skip virtual filesystems
		if strings.HasPrefix(p.Mountpoint, "/snap") || strings.HasPrefix(p.Mountpoint, "/sys") ||
			strings.HasPrefix(p.Mountpoint, "/proc") || strings.HasPrefix(p.Mountpoint, "/dev") ||
			strings.HasPrefix(p.Mountpoint, "/run") {
			continue
		}
		if p.Fstype == "tmpfs" || p.Fstype == "devtmpfs" || p.Fstype == "squashfs" || p.Fstype == "overlay" {
			continue
		}
		usage, err := disk.Usage(p.Mountpoint)
		if err != nil || usage.Total == 0 {
			continue
		}
		seen[p.Mountpoint] = true
		disks = append(disks, map[string]interface{}{
			"device":   p.Device,
			"mount":    p.Mountpoint,
			"pct":      fmt.Sprintf("%d%%", int(usage.UsedPercent)),
			"total_gb": fmt.Sprintf("%.1f", float64(usage.Total)/1e9),
			"used_gb":  fmt.Sprintf("%.1f", float64(usage.Used)/1e9),
			"free_gb":  fmt.Sprintf("%.1f", float64(usage.Free)/1e9),
		})
	}
	if disks == nil {
		disks = []map[string]interface{}{}
	}

	// DNS servers
	var dnsServers []string
	if runtime.GOOS != "windows" {
		if data, err := os.ReadFile("/etc/resolv.conf"); err == nil {
			for _, line := range strings.Split(string(data), "\n") {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "nameserver") {
					parts := strings.Fields(line)
					if len(parts) >= 2 {
						dnsServers = append(dnsServers, parts[1])
					}
				}
			}
		}
	}
	if dnsServers == nil {
		dnsServers = []string{}
	}

	// Network interfaces
	var interfaces []map[string]interface{}
	if runtime.GOOS != "windows" {
		out, _ := runShell("ip -j addr show 2>/dev/null")
		if out != "" {
			var ipData []struct {
				IfName    string `json:"ifname"`
				OperState string `json:"operstate"`
				Mtu       int    `json:"mtu"`
				Address   string `json:"address"`
				Link      string `json:"link_type"`
				AddrInfo  []struct {
					Family    string `json:"family"`
					Local     string `json:"local"`
					PrefixLen int    `json:"prefixlen"`
				} `json:"addr_info"`
			}
			if json.Unmarshal([]byte(out), &ipData) == nil {
				// Get default gateway
				gateway := ""
				if gw, _ := runShell("ip route show default 2>/dev/null | awk '{print $3}' | head -1"); gw != "" {
					gateway = strings.TrimSpace(gw)
				}
				for _, iface := range ipData {
					ifType := iface.Link
					if iface.IfName == "lo" {
						ifType = "loopback"
					}
					var addrs []map[string]string
					for _, a := range iface.AddrInfo {
						addrs = append(addrs, map[string]string{
							"family":  a.Family,
							"address": fmt.Sprintf("%s/%d", a.Local, a.PrefixLen),
						})
					}
					if addrs == nil {
						addrs = []map[string]string{}
					}
					interfaces = append(interfaces, map[string]interface{}{
						"name":      iface.IfName,
						"type":      ifType,
						"up":        strings.EqualFold(iface.OperState, "UP") || strings.EqualFold(iface.OperState, "UNKNOWN"),
						"mac":       iface.Address,
						"mtu":       iface.Mtu,
						"addresses": addrs,
						"gateway":   gateway,
					})
				}
			}
		}
	}
	if interfaces == nil {
		interfaces = []map[string]interface{}{}
	}

	// RAM
	ramTotalGiB := 0.0
	swapTotalGiB := 0.0
	if memStat != nil {
		ramTotalGiB = round2(float64(memStat.Total) / (1024 * 1024 * 1024))
	}
	if swapStat != nil {
		swapTotalGiB = round2(float64(swapStat.Total) / (1024 * 1024 * 1024))
	}

	info := map[string]interface{}{
		"hostname":            hostname(),
		"ip":                  localIP(),
		"architecture":        runtime.GOARCH,
		"kernel_running":      kernelRunning,
		"selinux":             selinux,
		"uptime":              uptimeStr,
		"cpu_model":           cpuModel,
		"cpu_cores":           cpuCoresPhysical,
		"cpu_cores_physical":  cpuCores,
		"ram_total_gib":       ramTotalGiB,
		"swap_total_gib":      swapTotalGiB,
		"load_avg":            loadAvg,
		"disks":               disks,
		"dns_servers":         dnsServers,
		"interfaces":          interfaces,
	}
	if hostStat != nil {
		info["os"] = hostStat.Platform + " " + hostStat.PlatformVersion
		info["platform"] = hostStat.Platform
	}
	data, _ := json.Marshal(info)
	return string(data)
}

func systemInfoCmd() string {
	if runtime.GOOS == "windows" {
		return "systeminfo"
	}
	return "uname -a && lsb_release -a 2>/dev/null || cat /etc/os-release"
}

func listServicesCmd() string {
	if runtime.GOOS == "windows" {
		return "sc query type= all state= all"
	}
	return "systemctl list-units --type=service --no-pager --plain 2>/dev/null || service --status-all 2>&1"
}

func serviceCmd(action, name string) string {
	if runtime.GOOS == "windows" {
		switch action {
		case "start":
			return fmt.Sprintf("net start %s", name)
		case "stop":
			return fmt.Sprintf("net stop %s", name)
		case "restart":
			return fmt.Sprintf("net stop %s & net start %s", name, name)
		case "status":
			return fmt.Sprintf("sc query %s", name)
		}
	}
	return fmt.Sprintf("systemctl %s %s", action, name)
}

// ─── Daily update check ───────────────────────────────────────────────────────

type updateState struct {
	mu          sync.Mutex
	upgradable  int
	reboot      bool
	lastChecked time.Time
}

func (u *updateState) get() (int, bool) {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.upgradable, u.reboot
}

func (u *updateState) refresh(pm *pkgManager) {
	if pm != nil {
		runCmd(pm.update...)
	}
	upgradable := countUpgradable(pm)
	reboot := rebootRequired()
	u.mu.Lock()
	u.upgradable = upgradable
	u.reboot = reboot
	u.lastChecked = time.Now()
	u.mu.Unlock()
	log.Printf("[update] upgradable=%d reboot_required=%v", upgradable, reboot)
}

func startDailyChecker(pm *pkgManager, state *updateState) {
	// initial check after 30s to not delay startup
	time.AfterFunc(30*time.Second, func() {
		state.refresh(pm)
		ticker := time.NewTicker(24 * time.Hour)
		for range ticker.C {
			state.refresh(pm)
		}
	})
}

// ─── WebSocket agent ──────────────────────────────────────────────────────────

func wsURL(serverURL, token string) string {
	// convert http(s) to ws(s)
	u := serverURL
	u = strings.TrimRight(u, "/")
	u = strings.Replace(u, "https://", "wss://", 1)
	u = strings.Replace(u, "http://", "ws://", 1)
	return u + "/ws/agent?token=" + token
}

func runAgent(cfg *Config) {
	pm := detectPkgMgr()
	if pm != nil {
		log.Printf("[agent] package manager: %s", pm.name)
	} else if runtime.GOOS != "windows" {
		log.Printf("[agent] no supported package manager found")
	}

	state := &updateState{}
	startDailyChecker(pm, state)

	url := wsURL(cfg.ServerURL, cfg.Token)
	log.Printf("[agent] connecting to %s", cfg.ServerURL)

	backoff := 5 * time.Second
	maxBackoff := 5 * time.Minute

	for {
		if err := connect(url, cfg, pm, state); err != nil {
			log.Printf("[agent] disconnected: %v — reconnecting in %s", err, backoff)
		} else {
			log.Printf("[agent] disconnected — reconnecting in %s", backoff)
		}
		time.Sleep(backoff)
		backoff *= 2
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
	}
}

func connect(url string, cfg *Config, pm *pkgManager, state *updateState) error {
	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 15 * time.Second

	conn, _, err := dialer.Dial(url, nil)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer conn.Close()
	log.Printf("[agent] connected")

	// Send register message first — backend expects this as the first message
	registerMsg := map[string]string{
		"type":     "register",
		"ip":       localIP(),
		"hostname": hostname(),
		"platform": runtime.GOOS,
	}
	regData, _ := json.Marshal(registerMsg)
	if err := conn.WriteMessage(websocket.TextMessage, regData); err != nil {
		return fmt.Errorf("register: %w", err)
	}

	var mu sync.Mutex
	done := make(chan struct{})

	// metric push goroutine
	go func() {
		ticker := time.NewTicker(time.Duration(cfg.Interval) * time.Second)
		defer ticker.Stop()
		// send immediately on connect
		sendMetrics(conn, &mu, state)
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				sendMetrics(conn, &mu, state)
			}
		}
	}()

	// read commands
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			close(done)
			return fmt.Errorf("read: %w", err)
		}
		var incoming IncomingMsg
		if err := json.Unmarshal(msg, &incoming); err != nil {
			log.Printf("[agent] bad message: %s", msg)
			continue
		}
		go func(in IncomingMsg) {
			log.Printf("[agent] command: %s", in.Command)
			output := handleCommand(in.Command, in.Target, pm, cfg)
			resp := ResultMsg{
				Type:      "result",
				RequestID: in.RequestID,
				Result:    map[string]interface{}{"output": output, "returncode": 0, "status": "completed"},
			}
			data, _ := json.Marshal(resp)
			mu.Lock()
			conn.WriteMessage(websocket.TextMessage, data)
			mu.Unlock()
		}(incoming)
	}
}

func sendMetrics(conn *websocket.Conn, mu *sync.Mutex, state *updateState) {
	upgradable, reboot := state.get()
	m, err := collectMetrics(upgradable, reboot)
	if err != nil {
		log.Printf("[agent] metrics error: %v", err)
		return
	}
	report := ReportMsg{
		Type:    "report",
		Metrics: m,
		PendingUpdates: &PendingUpdates{
			Count:          upgradable,
			RebootRequired: reboot,
		},
	}
	data, err := json.Marshal(report)
	if err != nil {
		return
	}
	mu.Lock()
	conn.WriteMessage(websocket.TextMessage, data)
	mu.Unlock()
}

// ─── Windows Service support ──────────────────────────────────────────────────

// On Windows, if running as a service, stdin/stdout are not a terminal.
// We rely on the golang.org/x/sys/windows/svc package only when explicitly
// installed as a service. For simplicity, the binary runs in foreground mode
// by default; wrap with NSSM or sc.exe to run as a Windows service.

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	var (
		configPath string
		install    bool
		uninstall  bool
		version    bool
	)
	flag.StringVar(&configPath, "config", "", "Path to config file")
	flag.BoolVar(&install, "install", false, "Install as system service (Linux: systemd, Windows: sc.exe)")
	flag.BoolVar(&uninstall, "uninstall", false, "Uninstall system service")
	flag.BoolVar(&version, "version", false, "Print version and exit")
	flag.Parse()

	if version {
		fmt.Println("serverctl-agent version 1.0.0 (go)")
		os.Exit(0)
	}

	if install {
		if err := installService(); err != nil {
			log.Fatalf("[agent] install failed: %v", err)
		}
		os.Exit(0)
	}

	if uninstall {
		if err := uninstallService(); err != nil {
			log.Fatalf("[agent] uninstall failed: %v", err)
		}
		os.Exit(0)
	}

	cfg, cfgPath, err := findConfig(configPath)
	if err != nil {
		log.Fatalf("[agent] config error: %v", err)
	}
	log.Printf("[agent] config: %s", cfgPath)

	if cfg.ServerURL == "" || cfg.Token == "" {
		log.Fatalf("[agent] server_url and token are required in config")
	}

	runAgent(cfg)
}

func installService() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	if runtime.GOOS == "windows" {
		out, err := runShell(fmt.Sprintf(
			`sc create serverctl-agent binPath= "%s" start= auto DisplayName= "ServerCtl Agent"`, exe))
		if err != nil {
			return fmt.Errorf("%s: %w", out, err)
		}
		_, err = runShell("sc start serverctl-agent")
		fmt.Println("Service installed and started.")
		return err
	}
	// Linux: write systemd unit
	unit := fmt.Sprintf(`[Unit]
Description=ServerCtl Agent
After=network.target

[Service]
ExecStart=%s
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=serverctl-agent

[Install]
WantedBy=multi-user.target
`, exe)
	unitPath := "/etc/systemd/system/serverctl-agent.service"
	if err := os.WriteFile(unitPath, []byte(unit), 0644); err != nil {
		return err
	}
	runShell("systemctl daemon-reload")
	runShell("systemctl enable serverctl-agent")
	runShell("systemctl start serverctl-agent")
	fmt.Println("Service installed and started via systemd.")
	return nil
}

func uninstallService() error {
	if runtime.GOOS == "windows" {
		runShell("sc stop serverctl-agent")
		out, err := runShell("sc delete serverctl-agent")
		if err != nil {
			return fmt.Errorf("%s: %w", out, err)
		}
		fmt.Println("Service removed.")
		return nil
	}
	runShell("systemctl stop serverctl-agent")
	runShell("systemctl disable serverctl-agent")
	os.Remove("/etc/systemd/system/serverctl-agent.service")
	runShell("systemctl daemon-reload")
	fmt.Println("Service removed.")
	return nil
}
