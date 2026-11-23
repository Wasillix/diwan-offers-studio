# Shared helpers for the Studio's install, update and launch scripts (dot-sourced, Windows PowerShell 5.1).
# Keep this file ASCII: Windows PowerShell reads BOM-less scripts in the ANSI code page.

$Root = Split-Path -Parent $PSScriptRoot

function Step([string]$Text) { Write-Host ''; Write-Host "== $Text" -ForegroundColor Cyan }
function Say([string]$Text, [string]$Color = 'Gray') { Write-Host "   $Text" -ForegroundColor $Color }

# winget installs change PATH in the registry only; pick the new value up in this window.
function Update-PathEnv {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

# Runs a native command and throws when it fails (native commands don't stop on errors by themselves).
function Invoke-Native([string]$What, [scriptblock]$Run) {
  & $Run
  if ($LASTEXITCODE -ne 0) { throw "$What failed (exit code $LASTEXITCODE)." }
}

# Runs a native command quietly and returns whether it succeeded. Redirecting a native command's stderr in
# Windows PowerShell turns each line into an error record, so errors must not stop the script here.
function Test-Native([scriptblock]$Run) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Run *> $null; return ($LASTEXITCODE -eq 0) } finally { $ErrorActionPreference = $old }
}

function Get-StudioPort {
  $port = 4321
  $envFile = Join-Path $Root '.env'
  if (Test-Path -LiteralPath $envFile) {
    foreach ($line in Get-Content -LiteralPath $envFile) { if ($line -match '^\s*PORT\s*=\s*(\d+)\s*$') { $port = [int]$Matches[1] } }
  }
  return $port
}

function Test-StudioUp([int]$Port) {
  try { return ((Invoke-WebRequest "http://127.0.0.1:$Port/api/meta" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) } catch { return $false }
}

# The Studio's node process for this folder (started by the shortcut, Start with Windows, or Install).
function Get-StudioProcess {
  $needle = (Join-Path $Root 'server\index.js').ToLower()
  @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains($needle) })
}

# Starting the Studio is scripts\open-studio.mjs (plain Node, no PowerShell): see server\powershell.js for why.
