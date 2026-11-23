@echo off
rem Diwan Offers Studio installer. Double-click it to install the Studio on this PC, or to repair an install.
rem Works on its own (download just this file from GitHub) or from inside a copy of the Studio.
rem Everything after the marker line below is PowerShell; these first lines only start it.
setlocal
set "DIWAN_INSTALL_CMD=%~f0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$s = [IO.File]::ReadAllText($env:DIWAN_INSTALL_CMD); $i = $s.IndexOf('#' + '#PS' + '#'); Invoke-Expression $s.Substring($i)"
set "ERR=%ERRORLEVEL%"
if not defined DIWAN_NOPAUSE pause
exit /b %ERR%
##PS#
# Optional settings for testing or special cases (environment variables):
#   DIWAN_REPO   git URL to install from        DIWAN_DIR  install folder (skips the question)
#   DIWAN_YES    answer every question with the default     DIWAN_NO_OPEN  don't open the Studio at the end
#   DIWAN_SHORTCUT_DIR  put the shortcut there instead of the desktop and Start menu
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$DefaultRepo = 'https://github.com/Wasillix/diwan-offers-studio.git'

function Step([string]$Text) { Write-Host ''; Write-Host "== $Text" -ForegroundColor Cyan }
function Say([string]$Text, [string]$Color = 'Gray') { Write-Host "   $Text" -ForegroundColor $Color }
function Update-PathEnv { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Test-Cmd([string]$Name) { [bool](Get-Command $Name -ErrorAction SilentlyContinue) }

try {
  Write-Host 'Diwan Offers Studio installer' -ForegroundColor White

  Step 'Tools the Studio needs'
  $tools = @(
    @{ Cmd = 'git'; Id = 'Git.Git'; Name = 'Git for Windows' },
    @{ Cmd = 'node'; Id = 'OpenJS.NodeJS.LTS'; Name = 'Node.js' },
    @{ Cmd = 'py'; Id = 'Python.Python.3.12'; Name = 'Python 3' },
    @{ Cmd = 'ffmpeg'; Id = 'Gyan.FFmpeg'; Name = 'ffmpeg' }
  )
  foreach ($t in $tools) {
    if (Test-Cmd $t.Cmd) { Say "$($t.Name): found" Green; continue }
    if (-not (Test-Cmd 'winget')) { throw "$($t.Name) is missing, and winget isn't on this PC to install it. Install App Installer from the Microsoft Store (or $($t.Name) itself), then run Install.cmd again." }
    Say "$($t.Name): installing..." Yellow
    & winget install --id $t.Id -e --silent --accept-source-agreements --accept-package-agreements
    Update-PathEnv
    if (-not (Test-Cmd $t.Cmd)) { throw "$($t.Name) was installed, but this window can't see it yet. Close this window and run Install.cmd again." }
    Say "$($t.Name): installed" Green
  }

  Step 'Where the Studio goes'
  $here = Split-Path -Parent $env:DIWAN_INSTALL_CMD
  if ((Test-Path -LiteralPath (Join-Path $here '.git')) -and (Test-Path -LiteralPath (Join-Path $here 'server\index.js'))) {
    $Dir = $here
    Say "This copy: $Dir" Green
  } else {
    $Dir = if ($env:DIWAN_DIR) { $env:DIWAN_DIR } elseif (Test-Path 'D:\') { 'D:\Diwan\Offers Studio' } else { Join-Path $env:USERPROFILE 'Diwan\Offers Studio' }
    if (-not $env:DIWAN_DIR -and -not $env:DIWAN_YES) {
      $answer = Read-Host "   Install in $Dir ? Press Enter, or type another folder"
      if ($answer.Trim()) { $Dir = $answer.Trim().Trim('"') }
    }
    if (Test-Path -LiteralPath (Join-Path $Dir '.git')) {
      Say "The Studio is already in $Dir. Checking it over (use Update.cmd there for new versions)." Green
    } else {
      if ((Test-Path -LiteralPath $Dir) -and (Get-ChildItem -LiteralPath $Dir -Force | Select-Object -First 1)) { throw "$Dir already has other files in it. Run Install.cmd again and pick an empty or new folder." }
      $Repo = if ($env:DIWAN_REPO) { $env:DIWAN_REPO } else { $DefaultRepo }
      Step 'Downloading the Studio'
      Say 'If a GitHub sign-in window opens, sign in with an account that can see the Studio repo.' Yellow
      New-Item -ItemType Directory -Force (Split-Path -Parent $Dir) | Out-Null
      & git clone --quiet $Repo $Dir
      if ($LASTEXITCODE -ne 0) { throw "Couldn't download the Studio from $Repo. Check that the GitHub account you signed in with has access to it." }
      Say "Downloaded to $Dir" Green
    }
  }

  & (Join-Path $Dir 'scripts\setup.ps1')

  if (-not $env:DIWAN_NO_OPEN) {
    Step 'Opening the Studio'
    Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\wscript.exe') -ArgumentList "`"$(Join-Path $Dir 'scripts\Open Studio.vbs')`""
    Say 'It opens in your browser. The first time, it asks you to pick the folders on this PC.' Green
  }
  Write-Host ''
  Write-Host 'Installed. Next time, open it from the Diwan Offers Studio shortcut. For new versions, run Update.cmd in the Studio folder.' -ForegroundColor Green
} catch {
  Write-Host ''
  Write-Host "Install stopped: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
