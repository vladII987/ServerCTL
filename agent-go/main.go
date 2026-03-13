package main

import (
	"bufio"
	"bytes"
	"context"
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

var agentVersion = "1.3.6"

// ─── Config ──────────────────────────────────────────────────────────────────

type Config struct {
	ServerURL string `yaml:"server_url"`
	Token     string `yaml:"token"`
	Interval  int    `yaml:"interval"` // seconds between metric pushes
	path      string `yaml:"-"`        // config file path (not serialized)
}

var agentStartTime = time.Now()

var defaultConfigPaths = []string{
	"/etc/serverctl-agent/config.yaml",
	"/etc/serverctl-agent/config.yml",
	`C:\serverctl-agent\config.yaml`,
	`C:\Program Files\serverctl-agent\config.yaml`,
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
	cfg.path = path
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
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, "cmd", "/C", command)
	} else {
		cmd = exec.CommandContext(ctx, "bash", "-c", command)
	}
	var out bytes.Buffer
	var errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut
	err := cmd.Run()
	if ctx.Err() == context.DeadlineExceeded {
		return strings.TrimSpace(out.String() + errOut.String()), fmt.Errorf("command timed out after 60 seconds")
	}
	result := out.String() + errOut.String()
	return strings.TrimSpace(result), err
}

// runPowerShell writes a PS1 script to a temp file and executes it,
// avoiding escaping issues with special chars like $null, $?, $false.
func runPowerShell(script string) (string, error) {
	tmpScript := filepath.Join(os.TempDir(), "serverctl-ps.ps1")
	if err := os.WriteFile(tmpScript, []byte(script), 0644); err != nil {
		return "", fmt.Errorf("failed to write PS1 script: %v", err)
	}
	defer os.Remove(tmpScript)
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tmpScript)
	var out bytes.Buffer
	var errOut bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errOut
	err := cmd.Run()
	if ctx.Err() == context.DeadlineExceeded {
		return strings.TrimSpace(out.String() + errOut.String()), fmt.Errorf("command timed out after 120 seconds")
	}
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

func ensurePSWindowsUpdate() {
	runPowerShell(`if (-not (Get-Module -ListAvailable -Name PSWindowsUpdate)) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -ErrorAction SilentlyContinue | Out-Null
  Install-Module PSWindowsUpdate -Force -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
}`)
}

func countUpgradable(pm *pkgManager) int {
	if runtime.GOOS == "windows" {
		ensurePSWindowsUpdate()
		out, err := runPowerShell(`try {
  $updates = Get-WindowsUpdate -ErrorAction Stop
  if ($updates) { Write-Output $updates.Count } else { Write-Output "0" }
} catch {
  Write-Output "0"
}`)
		if err != nil {
			return 0
		}
		n, _ := strconv.Atoi(strings.TrimSpace(out))
		return n
	}
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
	case "agent_info":
		exePath, _ := os.Executable()
		info, _ := os.Stat(exePath)
		buildDate := ""
		if info != nil {
			buildDate = info.ModTime().Format("2006-01-02 15:04:05")
		}
		uptime := time.Since(agentStartTime).Round(time.Second).String()
		data, _ := json.Marshal(map[string]string{
			"version":    agentVersion,
			"go_version": runtime.Version(),
			"os":         runtime.GOOS,
			"arch":       runtime.GOARCH,
			"binary":     exePath,
			"build_date": buildDate,
			"uptime":     uptime,
			"config":     cfg.path,
			"server_url": cfg.ServerURL,
		})
		return string(data)

	case "check_reboot":
		if rebootRequired() {
			return "1"
		}
		return "0"

	case "upgradable_packages":
		if runtime.GOOS == "windows" {
			ensurePSWindowsUpdate()
			out, err := runPowerShell(`try {
  $updates = Get-WindowsUpdate -ErrorAction Stop
  if ($updates -and $updates.Count -gt 0) {
    $updates | ForEach-Object { Write-Output $_.Title }
  } else {
    Write-Output ""
  }
} catch {
  Write-Output ""
}`)
			if err != nil || strings.TrimSpace(out) == "" {
				return "0"
			}
			lines := strings.Split(strings.TrimSpace(out), "\n")
			pkgs := []string{}
			for _, l := range lines {
				l = strings.TrimSpace(l)
				if l != "" {
					pkgs = append(pkgs, l)
				}
			}
			if len(pkgs) == 0 {
				return "0"
			}
			data, _ := json.Marshal(map[string]interface{}{
				"count":    len(pkgs),
				"packages": pkgs,
			})
			return string(data)
		}
		if pm == nil {
			return "0"
		}
		if pm.name == "apt" {
			out, _ := runShell("apt list --upgradable --quiet 2>/dev/null")
			lines := strings.Split(out, "\n")
			pkgs := []string{}
			for _, l := range lines {
				l = strings.TrimSpace(l)
				if l == "" || strings.HasPrefix(l, "Listing") || strings.HasPrefix(l, "WARNING") {
					continue
				}
				if strings.Contains(l, "/") && strings.Contains(l, "[upgradable") {
					pkgs = append(pkgs, l)
				}
			}
			if len(pkgs) == 0 {
				return "0"
			}
			data, _ := json.Marshal(map[string]interface{}{
				"count":    len(pkgs),
				"packages": pkgs,
			})
			return string(data)
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
			out, _ := runPowerShell("Get-PSDrive -PSProvider FileSystem | Format-Table Name,@{N='Used(GB)';E={[math]::Round($_.Used/1GB,2)}},@{N='Free(GB)';E={[math]::Round($_.Free/1GB,2)}},@{N='Total(GB)';E={[math]::Round(($_.Used+$_.Free)/1GB,2)}},@{N='Used%';E={if(($_.Used+$_.Free) -gt 0){[math]::Round($_.Used/($_.Used+$_.Free)*100,1)}else{0}}} -AutoSize | Out-String -Width 300")
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

	case "ip_info":
		if runtime.GOOS == "windows" {
			out, _ := runPowerShell("Get-NetIPConfiguration | Format-List InterfaceAlias,IPv4Address,IPv4DefaultGateway,DNSServer")
			return out
		}
		var ipSb strings.Builder
		ipOut2, _ := runShell("ip -br addr show 2>/dev/null || ip addr show 2>/dev/null || ifconfig 2>/dev/null")
		ipSb.WriteString(ipOut2)
		gw2, _ := runShell("ip route show default 2>/dev/null")
		if strings.TrimSpace(gw2) != "" {
			ipSb.WriteString("\nDefault Gateway: " + strings.TrimSpace(gw2) + "\n")
		}
		dns2, _ := runShell("grep -v '^#' /etc/resolv.conf 2>/dev/null | grep nameserver")
		if strings.TrimSpace(dns2) != "" {
			ipSb.WriteString("\nDNS Servers:\n" + dns2)
		}
		return ipSb.String()

	case "firewall_status":
		if runtime.GOOS == "windows" {
			out, _ := runPowerShell("Get-NetFirewallProfile | Format-Table Name,Enabled,DefaultInboundAction,DefaultOutboundAction -AutoSize | Out-String -Width 300")
			return out
		}
		ufwOut2, _ := runShell("ufw status verbose 2>/dev/null")
		if strings.Contains(ufwOut2, "Status:") {
			return ufwOut2
		}
		fwdOut2, _ := runShell("firewall-cmd --state 2>/dev/null && firewall-cmd --list-all 2>/dev/null")
		if strings.TrimSpace(fwdOut2) != "" && !strings.Contains(fwdOut2, "not running") {
			return fwdOut2
		}
		iptOut2, _ := runShell("iptables -L -n --line-numbers 2>/dev/null")
		if strings.TrimSpace(iptOut2) != "" && !strings.Contains(iptOut2, "Permission denied") && !strings.Contains(iptOut2, "not found") {
			return iptOut2
		}
		return "No firewall detected (ufw/firewalld/iptables not active or not installed)"

	case "listening_ports":
		if runtime.GOOS == "windows" {
			out, _ := runPowerShell("Get-NetTCPConnection -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess | Sort-Object LocalPort | Format-Table -AutoSize | Out-String -Width 300")
			return out
		}
		out, _ := runShell("ss -tulnp 2>/dev/null || netstat -tulnp 2>/dev/null")
		return out

	case "cpu_info":
		if runtime.GOOS == "windows" {
			out, _ := runPowerShell("Get-CimInstance Win32_Processor | Format-List Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed,CurrentClockSpeed,L2CacheSize,L3CacheSize,Architecture")
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
		if runtime.GOOS == "windows" {
			out, _ := runPowerShell("Get-Service | Sort-Object Status -Descending | Format-Table -AutoSize Name,DisplayName,Status,StartType | Out-String -Width 300")
			return out
		}
		out, _ := runShell(listServicesCmd())
		return out

	case "service_status":
		svc := target
		if svc == "" {
			return "no service specified"
		}
		if runtime.GOOS == "windows" {
			out, _ := runPowerShell(fmt.Sprintf("Get-Service -Name '%s' | Format-List *", svc))
			return out
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
		if runtime.GOOS == "windows" {
			ensurePSWindowsUpdate()
			out, _ := runPowerShell(`try {
  $updates = Get-WindowsUpdate -ErrorAction Stop
  if ($updates) {
    Write-Output "$($updates.Count) update(s) available."
    $updates | ForEach-Object { Write-Output "  - $($_.Title)" }
  } else {
    Write-Output "No updates available."
  }
} catch {
  Write-Output "Failed to check updates: $_"
}`)
			return out
		}
		if pm == nil {
			return "No package manager found"
		}
		out, _, _ := runCmd(pm.update...)
		return out

	case "upgrade":
		if runtime.GOOS == "windows" {
			ensurePSWindowsUpdate()
			out, _ := runPowerShell(`try {
  $result = Get-WindowsUpdate -Install -AcceptAll -AutoReboot:$false -ErrorAction Stop
  if ($result) {
    Write-Output "$($result.Count) update(s) installed."
    $result | ForEach-Object { Write-Output "  - $($_.Title): $($_.Result)" }
  } else {
    Write-Output "No updates to install."
  }
} catch {
  Write-Output "Failed to install updates: $_"
}`)
			return out
		}
		if pm == nil {
			return "No package manager found"
		}
		runCmd(pm.update...) //nolint:errcheck
		out, _ := runShell(strings.Join(pm.upgrade, " "))
		return out

	case "update_packages":
		if runtime.GOOS == "windows" {
			ensurePSWindowsUpdate()
			out, _ := runPowerShell(`try {
  $result = Get-WindowsUpdate -Install -AcceptAll -AutoReboot:$false -ErrorAction Stop
  if ($result) {
    Write-Output "$($result.Count) update(s) installed."
    $result | ForEach-Object { Write-Output "  - $($_.Title): $($_.Result)" }
  } else {
    Write-Output "No updates to install."
  }
} catch {
  Write-Output "Failed to install updates: $_"
}`)
			return out
		}
		if pm == nil {
			return "No package manager found"
		}
		runCmd(pm.update...)
		out, _ := runShell(strings.Join(pm.upgrade, " "))
		return out

	case "docker_ps":
		out, _ := runShell("docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.ID}}' 2>/dev/null || echo 'docker not available'")
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
			// Use shutdown.exe directly via runCmd to avoid shell quoting issues
			go func() {
				time.Sleep(2 * time.Second)
				exec.Command("shutdown", "/r", "/t", "5", "/c", "ServerCTL reboot").Run()
			}()
			return "Rebooting in 7 seconds..."
		}
		out, _ := runShell("sudo reboot || reboot || shutdown -r now")
		return "Reboot initiated.\n" + out

	case "uninstall_agent":
		if runtime.GOOS == "windows" {
			tmpScript := filepath.Join(os.TempDir(), "serverctl-uninstall.ps1")
			script := "Start-Sleep 2\r\n" +
				"sc.exe stop serverctl-agent 2>$null\r\n" +
				"Get-Process -Name serverctl-agent -ErrorAction SilentlyContinue | Stop-Process -Force\r\n" +
				"Start-Sleep 2\r\n" +
				"sc.exe delete serverctl-agent 2>$null\r\n" +
				"Remove-Item -Recurse -Force C:\\serverctl-agent -ErrorAction SilentlyContinue\r\n"
			os.WriteFile(tmpScript, []byte(script), 0644)
			exec.Command("powershell", "-ExecutionPolicy", "Bypass", "-File", tmpScript).Start()
			return "Agent uninstall initiated. Service will be removed."
		}
		// Linux: write detached uninstall script
		uninstallScript := "#!/bin/sh\nsleep 2\nsystemctl stop serverctl-agent 2>/dev/null\nsystemctl disable serverctl-agent 2>/dev/null\nrm -f /etc/systemd/system/serverctl-agent.service\nsystemctl daemon-reload\nrm -f /usr/local/bin/serverctl-agent\nrm -rf /etc/serverctl-agent\n"
		os.WriteFile("/tmp/serverctl-uninstall.sh", []byte(uninstallScript), 0755)
		exec.Command("nohup", "sh", "/tmp/serverctl-uninstall.sh").Start()
		return "Agent uninstall initiated. Service will be removed."

	case "update_agent":
		// Run update in background after response is sent
		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("[update] PANIC in updateAgent: %v", r)
				}
			}()
			time.Sleep(2 * time.Second) // give time for response to be sent
			result := updateAgent(cfg)
			log.Printf("[update] result: %s", result)
		}()
		return "Agent update initiated. The agent will restart momentarily."

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

	case "ping_count":
		if target == "" {
			return "No target specified"
		}
		if runtime.GOOS == "windows" {
			out, _ := runShell(fmt.Sprintf("ping -n 4 %s", target))
			return out
		}
		out, _ := runShell(fmt.Sprintf("ping -c 4 %s", target))
		return out

	case "traceroute":
		if target == "" {
			return "No target specified"
		}
		if runtime.GOOS == "windows" {
			out, _ := runShell(fmt.Sprintf("tracert %s", target))
			return out
		}
		out, _ := runShell(fmt.Sprintf("traceroute %s 2>/dev/null || tracepath %s 2>/dev/null", target, target))
		return out

	case "nslookup":
		if target == "" {
			return "No target specified"
		}
		out, _ := runShell(fmt.Sprintf("nslookup %s", target))
		return out

	default:
		if strings.HasPrefix(command, "shell:") {
			out, _ := runShell(strings.TrimPrefix(command, "shell:"))
			return out
		}
		if strings.HasPrefix(command, "firewall:") {
			parts := strings.SplitN(command, ":", 3)
			if len(parts) < 2 {
				return "invalid firewall command"
			}
			action := parts[1]
			arg := ""
			if len(parts) == 3 {
				arg = parts[2]
			}
			switch action {
			case "enable":
				if runtime.GOOS == "windows" {
					out, _ := runPowerShell("Set-NetFirewallProfile -All -Enabled True; Get-NetFirewallProfile | Format-Table Name,Enabled -AutoSize | Out-String -Width 300")
					return out
				}
				out, _ := runShell("echo 'y' | ufw enable 2>&1")
				return out
			case "disable":
				if runtime.GOOS == "windows" {
					out, _ := runPowerShell("Set-NetFirewallProfile -All -Enabled False; Get-NetFirewallProfile | Format-Table Name,Enabled -AutoSize | Out-String -Width 300")
					return out
				}
				out, _ := runShell("ufw disable 2>&1")
				return out
			case "add":
				if arg == "" {
					return "missing rule argument"
				}
				if runtime.GOOS == "windows" {
					// arg format: "allow|deny,in|out,tcp|udp,port[,name]"
					p := strings.Split(arg, ",")
					if len(p) < 4 {
						return "format: allow|deny,in|out,tcp|udp,port[,name]"
					}
					act := "Allow"
					if strings.ToLower(p[0]) == "deny" || strings.ToLower(p[0]) == "block" {
						act = "Block"
					}
					dir := "Inbound"
					if strings.ToLower(p[1]) == "out" {
						dir = "Outbound"
					}
					proto := strings.ToUpper(p[2])
					port := p[3]
					name := fmt.Sprintf("ServerCTL_%s_%s_%s", act, proto, port)
					if len(p) >= 5 && p[4] != "" {
						name = p[4]
					}
					cmd := fmt.Sprintf(`New-NetFirewallRule -DisplayName "%s" -Direction %s -Action %s -Protocol %s -LocalPort %s -Enabled True | Format-List DisplayName,Direction,Action,Protocol,LocalPort,Enabled | Out-String -Width 300`, name, dir, act, proto, port)
					out, _ := runPowerShell(cmd)
					return out
				}
				// Linux ufw: arg format: "allow|deny,in|out,tcp|udp,port"
				p := strings.Split(arg, ",")
				if len(p) < 4 {
					return "format: allow|deny,in|out,tcp|udp,port"
				}
				act := strings.ToLower(p[0])
				dir := strings.ToLower(p[1])
				proto := strings.ToLower(p[2])
				port := p[3]
				cmd := fmt.Sprintf("ufw %s %s %s/%s 2>&1", act, dir, port, proto)
				out, _ := runShell(cmd)
				return out
			case "remove":
				if arg == "" {
					return "missing rule argument"
				}
				if runtime.GOOS == "windows" {
					// Remove by display name
					cmd := fmt.Sprintf(`Remove-NetFirewallRule -DisplayName "%s" 2>&1; Write-Output "Rule '%s' removed"`, arg, arg)
					out, _ := runPowerShell(cmd)
					return out
				}
				// Linux: arg is the full rule spec like "allow in 22/tcp"
				cmd := fmt.Sprintf("ufw delete %s 2>&1", arg)
				out, _ := runShell(cmd)
				return out
			default:
				return "unknown firewall action: " + action
			}
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
	var dirs []string
	if runtime.GOOS == "windows" {
		var files []map[string]interface{}
		// Windows Event Log channels
		channels := []string{"Application", "System", "Security", "Setup"}
		for _, ch := range channels {
			out, _ := runShell(fmt.Sprintf("powershell -Command \"try { $log = Get-WinEvent -ListLog '%s' -ErrorAction Stop; Write-Output ($log.RecordCount.ToString() + '|' + $log.LastWriteTime.ToString()) } catch { Write-Output '0|' }\"", ch))
			parts := strings.SplitN(strings.TrimSpace(out), "|", 2)
			count := int64(0)
			if len(parts) > 0 {
				fmt.Sscanf(parts[0], "%d", &count)
			}
			files = append(files, map[string]interface{}{
				"name": ch,
				"path": "winlog:" + ch,
				"size": count,
			})
		}
		if files == nil {
			files = []map[string]interface{}{}
		}
		data, _ := json.Marshal(files)
		return string(data)
	}
	dirs = []string{"/var/log"}
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
	// Windows Event Log
	if strings.HasPrefix(path, "winlog:") {
		logName := strings.TrimPrefix(path, "winlog:")
		// Write PS1 script to avoid escaping issues
		script := fmt.Sprintf("try {\n"+
			"  Get-WinEvent -LogName '%s' -MaxEvents 100 -ErrorAction Stop | ForEach-Object {\n"+
			"    $msg = $_.Message\n"+
			"    if ($msg) { $msg = ($msg -split [Environment]::NewLine)[0] }\n"+
			"    $_.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss') + ' [' + $_.LevelDisplayName + '] ' + $msg\n"+
			"  }\n"+
			"} catch {\n"+
			"  Write-Output ('Error reading %s: ' + $_.Exception.Message)\n"+
			"}\n", logName, logName)
		out, _ := runPowerShell(script)
		if strings.TrimSpace(out) == "" {
			return "No events found in " + logName
		}
		return out
	}
	// Linux: only allow /var/log for safety
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
	baseURL := strings.TrimRight(cfg.ServerURL, "/")
	baseURL = strings.Replace(baseURL, "ws://", "http://", 1)
	baseURL = strings.Replace(baseURL, "wss://", "https://", 1)

	exePath, _ := os.Executable()
	if exePath == "" {
		if runtime.GOOS == "windows" {
			exePath = `C:\serverctl-agent\serverctl-agent.exe`
		} else {
			exePath = "/usr/local/bin/serverctl-agent"
		}
	}
	installDir := filepath.Dir(exePath)
	logFile := filepath.Join(installDir, "update.log")
	writeLog := func(msg string) {
		line := fmt.Sprintf("[%s] %s\n", time.Now().Format("2006-01-02 15:04:05"), msg)
		f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err == nil {
			f.WriteString(line)
			f.Close()
		}
		log.Printf("[update] %s", msg)
	}

	writeLog("Starting agent update from " + baseURL)
	writeLog("Current binary: " + exePath)
	writeLog("Current version: " + agentVersion)

	if runtime.GOOS == "windows" {
		// Windows: trigger the pre-registered "ServerCtlUpdater" scheduled task
		// The task was created during install and runs as SYSTEM with highest privileges.
		// It calls the install-windows script which handles stop → download → start.
		// Try to trigger existing scheduled task first
		writeLog("Triggering ServerCtlUpdater scheduled task...")
		triggerScript := "try {\n" +
			"  $task = Get-ScheduledTask -TaskName 'ServerCtlUpdater' -ErrorAction Stop\n" +
			"  Start-ScheduledTask -TaskName 'ServerCtlUpdater'\n" +
			"  Write-Output \"OK: Task triggered\"\n" +
			"} catch {\n" +
			"  Write-Output \"ERROR: $_\"\n" +
			"}\n"
		out, err := runPowerShell(triggerScript)
		writeLog("Task trigger result: " + out)
		if err != nil || strings.Contains(out, "ERROR:") {
			writeLog("Scheduled task not found, registering it now...")
			// Fallback: register the task and trigger it
			installURL := baseURL + "/api/agent/install-windows?token=" + cfg.Token
			registerScript := "$ErrorActionPreference = 'Stop'\n" +
				"try {\n" +
				"  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument \"-NoProfile -ExecutionPolicy Bypass -Command `\"irm '" + installURL + "' | iex`\"\"\n" +
				"  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest\n" +
				"  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable\n" +
				"  Register-ScheduledTask -TaskName 'ServerCtlUpdater' -Action $action -Principal $principal -Settings $settings -Force | Out-Null\n" +
				"  Start-ScheduledTask -TaskName 'ServerCtlUpdater'\n" +
				"  Write-Output 'OK: Task registered and triggered'\n" +
				"} catch {\n" +
				"  Write-Output \"ERROR: $_\"\n" +
				"}\n"
			out2, _ := runPowerShell(registerScript)
			writeLog("Fallback register result: " + out2)
			if strings.Contains(out2, "ERROR:") {
				return "Update failed: " + out2
			}
			return "Agent update triggered (task was re-registered). Service will restart momentarily."
		}
		return "Agent update triggered via ServerCtlUpdater task. Service will restart momentarily."
	}

	// Linux: stop → download → start with rollback via systemd-run
	dlURL := baseURL + "/api/agent/download/linux-" + runtime.GOARCH
	scriptPath := filepath.Join(os.TempDir(), "serverctl-update.sh")
	script := fmt.Sprintf(`#!/bin/bash
LOG="%s"
BIN="%s"
DL_URL="%s"
OLD="%s"

log() { echo "[$(date '+%%Y-%%m-%%d %%H:%%M:%%S')] $1" >> "$LOG"; }

log "Update script started"
sleep 2

log "Stopping service..."
systemctl stop serverctl-agent 2>/dev/null
sleep 2

# Backup
log "Backing up old binary..."
cp "$BIN" "$OLD"

# Download
log "Downloading from $DL_URL"
if curl -fsSL -o "$BIN" "$DL_URL"; then
    chmod +x "$BIN"
    log "Download complete"
else
    log "Download FAILED — restoring backup"
    cp "$OLD" "$BIN"
    chmod +x "$BIN"
    systemctl start serverctl-agent
    log "Rollback complete"
    exit 1
fi

# Start and healthcheck
log "Starting new agent..."
systemctl start serverctl-agent
sleep 15

if systemctl is-active --quiet serverctl-agent; then
    log "Healthcheck PASSED — new agent is running"
    rm -f "$OLD"
    log "Update complete!"
else
    log "Healthcheck FAILED — rolling back!"
    systemctl stop serverctl-agent 2>/dev/null
    sleep 2
    cp "$OLD" "$BIN"
    chmod +x "$BIN"
    systemctl start serverctl-agent
    log "Rollback complete. Old agent restored."
fi
`, logFile, exePath, dlURL, exePath+".old")

	os.WriteFile(scriptPath, []byte(script), 0755)
	exec.Command("systemd-run", "--no-block", "bash", scriptPath).Start()
	writeLog("Update script launched via systemd-run")
	return "Agent update started. Service will restart in ~5 seconds."
}

func repoSpeedTest() string {
	var repos []struct{ name, url string }
	if runtime.GOOS == "windows" {
		repos = []struct{ name, url string }{
			{"Microsoft CDN", "https://download.microsoft.com/download/robots.txt"},
			{"Winget CDN", "https://cdn.winget.microsoft.com/cache/source2.msix"},
			{"Cloudflare", "https://speed.cloudflare.com/__down?bytes=262144"},
		}
	} else {
		repos = []struct{ name, url string }{
			{"Ubuntu Archive", "http://archive.ubuntu.com/ubuntu/dists/noble/Release"},
			{"Ubuntu Security", "http://security.ubuntu.com/ubuntu/dists/noble-security/Release"},
			{"Ubuntu Updates", "http://archive.ubuntu.com/ubuntu/dists/noble-updates/Release"},
		}
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
		return "powershell -Command \"Get-Service | Sort-Object Status -Descending | Format-Table -AutoSize Name,DisplayName,Status,StartType\""
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
		ticker := time.NewTicker(6 * time.Hour)
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
		connStart := time.Now()
		if err := connect(url, cfg, pm, state); err != nil {
			log.Printf("[agent] disconnected: %v — reconnecting in %s", err, backoff)
		} else {
			log.Printf("[agent] disconnected — reconnecting in %s", backoff)
		}
		// Reset backoff if we were connected for more than 30 seconds
		if time.Since(connStart) > 30*time.Second {
			backoff = 5 * time.Second
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
		"version":  agentVersion,
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
			// Refresh pending updates count after package operations
			if in.Command == "upgrade" || in.Command == "update" || in.Command == "update_packages" {
				state.refresh(pm)
				sendMetrics(conn, &mu, state)
			}
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
		fmt.Printf("serverctl-agent version %s (go)\n", agentVersion)
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

	if isWindowsService() {
		log.Println("[agent] running as Windows service")
		runWindowsService(cfg)
	} else {
		runAgent(cfg)
	}
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
