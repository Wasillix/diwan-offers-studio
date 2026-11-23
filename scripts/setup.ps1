# Sets up, or refreshes, this copy of Diwan Offers Studio. Install.cmd and Update.cmd run it, and it is safe
# to run again. It never changes data\ (your weeks), the values in .env, or the photo library.
param([switch]$Update)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'lib.ps1')
Set-Location -LiteralPath $Root

Step 'Node packages'
$lockHash = (Get-FileHash -LiteralPath (Join-Path $Root 'package-lock.json')).Hash
$stamp = Join-Path $Root 'node_modules\.diwan-lock'
$packagesChanged = $false
if ((Test-Path -LiteralPath $stamp) -and ((Get-Content -LiteralPath $stamp -Raw).Trim() -eq $lockHash)) {
  Say 'Up to date' Green
} else {
  Invoke-Native 'Installing the Node packages' { npm.cmd ci --no-audit --no-fund }
  Set-Content -LiteralPath $stamp $lockHash -Encoding ascii
  $packagesChanged = $true
  Say 'Installed' Green
}

# Optional (the renders fall back to Microsoft Edge), so it gets a time limit: on some PCs Playwright's
# unpacking step hangs forever after the download. An update only retries it when the packages changed.
Step 'Browser for the renders'
if ($Update -and -not $packagesChanged) {
  Say 'Unchanged' Green
} else {
  Say 'Getting the render browser (about 90 MB; up to 6 minutes)...'
  $pw = Start-Process -FilePath $env:ComSpec -ArgumentList '/c npx.cmd playwright install --only-shell chromium' -WorkingDirectory $Root -WindowStyle Hidden -PassThru
  $null = $pw.Handle # keeps ExitCode readable after the process ends (Windows PowerShell quirk)
  if ($pw.WaitForExit(360000) -and $pw.ExitCode -eq 0) { Say 'Ready' Green }
  else {
    if (-not $pw.HasExited) { [void](Test-Native { taskkill.exe /T /F /PID $pw.Id }) }
    Say 'Skipped: the renders will use Microsoft Edge instead, which also works.' Yellow
  }
}

Step 'Python packages'
Invoke-Native 'Installing the Python packages' { py -3 -m pip install --disable-pip-version-check -q pillow pypdf reportlab openpyxl fonttools brotli }
Say 'Ready' Green

Step 'Settings file'
New-Item -ItemType Directory -Force (Join-Path $Root 'data') | Out-Null
if (Test-Path -LiteralPath (Join-Path $Root '.env')) { Say '.env kept as it is' Green }
else { Copy-Item -LiteralPath (Join-Path $Root '.env.example') (Join-Path $Root '.env'); Say 'Made .env from .env.example' Green }

# The cut-out cache (toolkit\img, img_pdf, canvas_assets) isn't in the code: it grows on each PC as weeks are
# delivered. The repo's "assets" branch holds a shared pack (scripts\publish-assets.ps1 sends to it). Only
# files this PC doesn't have yet are copied in; nothing here is ever replaced or deleted.
Step 'Product cut-outs'
if (Test-Native { git ls-remote --exit-code --heads origin assets }) {
  Invoke-Native 'Downloading the cut-outs' { git fetch --quiet --no-tags --depth 1 origin '+refs/heads/assets:refs/diwan/assets' }
  $tmp = Join-Path $env:TEMP ('diwan-assets-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory $tmp | Out-Null
  try {
    $tar = Join-Path $tmp 'assets.tar'
    Invoke-Native 'Unpacking the cut-outs' { git archive --format=tar -o $tar refs/diwan/assets }
    Invoke-Native 'Unpacking the cut-outs' { & "$env:SystemRoot\System32\tar.exe" -xf $tar -C $tmp }
    $added = 0
    foreach ($d in 'img', 'img_pdf', 'canvas_assets') {
      $src = Join-Path $tmp $d
      if (-not (Test-Path -LiteralPath $src)) { continue }
      $dst = Join-Path $Root "toolkit\$d"
      New-Item -ItemType Directory -Force $dst | Out-Null
      foreach ($f in Get-ChildItem -LiteralPath $src -File) {
        $to = Join-Path $dst $f.Name
        if (-not (Test-Path -LiteralPath $to)) { Copy-Item -LiteralPath $f.FullName $to; $added++ }
      }
    }
    Say "$added new cut-outs added (ones already on this PC are kept)" Green
  } finally { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
} else {
  Say 'No shared cut-out pack in the repo yet. The agent makes cut-outs as weeks need them.' Yellow
}

if (-not $Update) {
  Step 'Shortcuts'
  $vbs = Join-Path $PSScriptRoot 'Open Studio.vbs'
  $ico = Join-Path $Root 'web\img\studio.ico'
  $dirs = if ($env:DIWAN_SHORTCUT_DIR) { @($env:DIWAN_SHORTCUT_DIR) } else { @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs')) }
  $shell = New-Object -ComObject WScript.Shell
  foreach ($d in $dirs) {
    New-Item -ItemType Directory -Force $d | Out-Null
    $lnk = $shell.CreateShortcut((Join-Path $d 'Diwan Offers Studio.lnk'))
    $lnk.TargetPath = Join-Path $env:SystemRoot 'System32\wscript.exe'
    $lnk.Arguments = "`"$vbs`""
    $lnk.WorkingDirectory = $Root
    $lnk.IconLocation = "$ico,0"
    $lnk.Description = 'Open Diwan Offers Studio'
    $lnk.Save()
  }
  Say 'Diwan Offers Studio on the desktop and in the Start menu' Green

  Step 'Claude sign-in'
  $envText = Get-Content -LiteralPath (Join-Path $Root '.env') -Raw
  $hasKey = $envText -match '(?m)^\s*ANTHROPIC_API_KEY\s*=\s*\S'
  $cred = Join-Path $env:USERPROFILE '.claude\.credentials.json'
  if ($hasKey -or (Test-Path -LiteralPath $cred)) {
    Say 'Signed in' Green
  } elseif ($env:DIWAN_YES) {
    Say 'Not signed in. Later: open a terminal, run claude, and sign in. The Studio works without it; the agent does not.' Yellow
  } else {
    if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
      Say 'Installing Claude Code...'
      Invoke-Native 'Installing Claude Code' { npm.cmd install -g '@anthropic-ai/claude-code' --no-audit --no-fund }
      Update-PathEnv
    }
    Say 'A Claude window opens next. Sign in with the Claude account the agent should use, then type /exit.' Yellow
    [void](Read-Host '   Press Enter to open it')
    Start-Process -FilePath 'claude.cmd' -Wait
    if (Test-Path -LiteralPath $cred) { Say 'Signed in' Green }
    else { Say 'Still not signed in. The Setup page in the Studio shows how to finish it.' Yellow }
  }
}
