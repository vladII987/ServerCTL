# ServerCtl Agent — Windows installer
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install.ps1

param(
    [string]$ServerURL = "",
    [string]$Token     = "",
    [string]$InstallDir = "C:\Program Files\serverctl-agent"
)

$ErrorActionPreference = "Stop"
$BinaryName = "serverctl-agent-windows-amd64.exe"
$ServiceName = "serverctl-agent"

# ── Require admin ──────────────────────────────────────────────────────────────
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Please run this script as Administrator."
    exit 1
}

# ── Create install directory ───────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Write-Host "Install directory: $InstallDir"

# ── Copy binary ────────────────────────────────────────────────────────────────
$src = Join-Path $PSScriptRoot $BinaryName
if (-not (Test-Path $src)) {
    Write-Error "Binary not found: $src — place $BinaryName next to this script."
    exit 1
}
$exe = Join-Path $InstallDir "serverctl-agent.exe"
Copy-Item -Force $src $exe
Write-Host "Copied binary to $exe"

# ── Write config ───────────────────────────────────────────────────────────────
$configPath = Join-Path $InstallDir "config.yaml"

if (-not (Test-Path $configPath)) {
    if ($ServerURL -eq "" -or $Token -eq "") {
        $ServerURL = Read-Host "Enter ServerCtl backend URL (e.g. http://192.168.1.10:8000)"
        $Token     = Read-Host "Enter agent token (from wizard Step 3)"
    }
    @"
server_url: "$ServerURL"
token: "$Token"
interval: 30
"@ | Set-Content -Path $configPath -Encoding UTF8
    Write-Host "Config written to $configPath"
} else {
    Write-Host "Config already exists at $configPath — skipping."
}

# ── Install Windows service via sc.exe ────────────────────────────────────────
$existing = sc.exe query $ServiceName 2>&1
if ($existing -match "FAILED") {
    sc.exe create $ServiceName binPath= "`"$exe`" -config `"$configPath`"" start= auto DisplayName= "ServerCtl Agent" | Out-Null
    Write-Host "Service '$ServiceName' created."
} else {
    Write-Host "Service '$ServiceName' already exists — updating binary path."
    sc.exe config $ServiceName binPath= "`"$exe`" -config `"$configPath`"" | Out-Null
}

sc.exe description $ServiceName "ServerCtl monitoring agent — reports metrics over WebSocket" | Out-Null
sc.exe start $ServiceName 2>&1 | Out-Null

$status = (sc.exe query $ServiceName | Select-String "STATE").ToString().Trim()
Write-Host "Service status: $status"
Write-Host ""
Write-Host "Done! Agent is running as a Windows service."
Write-Host "To check logs: eventvwr (Application log, source: serverctl-agent)"
Write-Host "To stop:  sc.exe stop $ServiceName"
Write-Host "To remove: sc.exe stop $ServiceName; sc.exe delete $ServiceName"
