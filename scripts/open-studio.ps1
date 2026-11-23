# What the "Diwan Offers Studio" shortcut runs (through Open Studio.vbs, with no window): starts the Studio
# if it isn't running yet, then opens it in the browser.
param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'lib.ps1')

# Error box; closes itself after 2 minutes so a launcher never waits forever.
function Show-Problem([string]$Text) { [void](New-Object -ComObject WScript.Shell).Popup($Text, 120, 'Diwan Offers Studio', 16) }

try {
  $port = Get-StudioPort
  if (-not (Test-StudioUp $port)) {
    $log = Start-Studio
    if (-not (Wait-StudioUp $port 40)) { Show-Problem "The Studio didn't start. The reason is at the end of:`n$log"; exit 1 }
  }
  if (-not $NoBrowser) { Start-Process "http://localhost:$port/" }
} catch {
  Show-Problem $_.Exception.Message
  exit 1
}
