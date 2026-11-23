# Updates this copy of Diwan Offers Studio from GitHub. Update.cmd runs it. Your weeks (data\), .env and
# settings stay as they are. If the Studio is running it is stopped for the update and started again.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'lib.ps1')
Set-Location -LiteralPath $Root

try {
  Write-Host 'Diwan Offers Studio update' -ForegroundColor White
  Step 'Checking this copy'
  $dirty = @(& git status --porcelain --untracked-files=no)
  if ($dirty.Count) {
    Say 'These Studio files were changed on this PC, and the update would overwrite them:' Yellow
    foreach ($l in $dirty) { Say $l }
    throw 'Nothing was updated. Undo those changes first, or ask for help.'
  }
  $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
  Say "Version $((& git log -1 --format='%h, %ad' --date=short).Trim()) on $branch" Green

  Step 'Downloading the latest version'
  Invoke-Native 'Checking GitHub' { git fetch --quiet --no-tags origin $branch }
  $behind = [int](& git rev-list --count "HEAD..origin/$branch")
  $ahead = [int](& git rev-list --count "origin/$branch..HEAD")
  $port = Get-StudioPort
  $restart = $false
  if ($behind -eq 0) {
    Say 'Already the latest version' Green
  } elseif ($ahead -gt 0) {
    throw "This copy has $ahead change(s) of its own that aren't on GitHub, so it can't update by itself. Ask for help."
  } else {
    Say "$behind new change(s)" Green
    if (Test-StudioUp $port) {
      Step 'Stopping the Studio for the update'
      foreach ($p in Get-StudioProcess) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
      for ($i = 0; $i -lt 20 -and (Test-StudioUp $port); $i++) { Start-Sleep -Milliseconds 500 }
      if (Test-StudioUp $port) { throw "The Studio is still running on port $port. Close its window (or the terminal running npm run dev) and run Update again." }
      $restart = $true
      Say 'Stopped' Green
    }
    Invoke-Native 'Applying the update' { git merge --ff-only --quiet "origin/$branch" }
    Say "Now on $((& git log -1 --format='%h, %ad' --date=short).Trim())" Green
  }

  & (Join-Path $PSScriptRoot 'setup.ps1') -Update

  if ($restart) {
    Step 'Starting the Studio again'
    $null = Start-Studio
    if (Wait-StudioUp $port) { Say "Running at http://localhost:$port" Green } else { Say 'It did not start within 30 s. See data\server.log.' Yellow }
  }
  Write-Host ''
  Write-Host 'Update finished.' -ForegroundColor Green
} catch {
  Write-Host ''
  Write-Host "Update stopped: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
