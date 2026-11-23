# Sends this PC's new product cut-outs (toolkit\img, img_pdf, canvas_assets) to the repo's "assets" branch on
# GitHub, so other PCs get them on their next install or update. It only adds files the pack doesn't have yet;
# it never replaces or deletes anything. Run it from the main PC: powershell -File scripts\publish-assets.ps1
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'lib.ps1')
Set-Location -LiteralPath $Root

$wt = Join-Path $env:TEMP ('diwan-assets-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$made = $false
try {
  Step 'Reading the cut-out pack on GitHub'
  if (Test-Native { git ls-remote --exit-code --heads origin assets }) {
    Invoke-Native 'Downloading the pack' { git fetch --quiet --no-tags origin '+refs/heads/assets:refs/remotes/origin/assets' }
    Invoke-Native 'Opening the pack' { git worktree add --quiet --detach $wt origin/assets }
    Say 'Found' Green
  } else {
    Invoke-Native 'Starting a pack' { git worktree add --quiet --detach $wt HEAD }
    Push-Location -LiteralPath $wt
    try { Invoke-Native 'Starting a pack' { git switch --quiet --orphan diwan-assets-new } } finally { Pop-Location }
    $made = $true
    Say 'None yet: starting one' Yellow
  }

  Step 'Adding new cut-outs'
  $added = 0
  foreach ($d in 'img', 'img_pdf', 'canvas_assets') {
    $src = Join-Path $Root "toolkit\$d"
    if (-not (Test-Path -LiteralPath $src)) { continue }
    $dst = Join-Path $wt $d
    New-Item -ItemType Directory -Force $dst | Out-Null
    foreach ($f in Get-ChildItem -LiteralPath $src -File) {
      $to = Join-Path $dst $f.Name
      if (-not (Test-Path -LiteralPath $to)) { Copy-Item -LiteralPath $f.FullName $to; $added++ }
    }
  }
  if (-not $added) { Say 'Nothing new: GitHub already has every cut-out on this PC.' Green; return }
  Say "$added new files" Green

  Step 'Sending them to GitHub'
  Push-Location -LiteralPath $wt
  try {
    Invoke-Native 'git add' { git add -A }
    Invoke-Native 'git commit' { git commit --quiet -m "Cut-outs: $added new files" }
    Invoke-Native 'Sending to GitHub' { git push --quiet origin HEAD:refs/heads/assets }
  } finally { Pop-Location }
  Say 'Done. Other PCs get them with Update.cmd.' Green
} catch {
  Write-Host "Stopped: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
} finally {
  if (Test-Path -LiteralPath $wt) { [void](Test-Native { git worktree remove --force $wt }) }
  if ($made) { [void](Test-Native { git branch -D diwan-assets-new }) }
}
