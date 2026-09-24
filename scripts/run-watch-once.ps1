param(
  [ValidateSet("makoto", "miki")]
  [string]$Target = "makoto"
)

$ErrorActionPreference = "Continue"
$repoRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $repoRoot "logs"
$logPath = Join-Path $logDir "watch.log"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location $repoRoot

function Add-LogLine {
  param([string]$Line)
  Add-Content -LiteralPath $logPath -Value $Line -Encoding UTF8
}

function Invoke-LoggedCommand {
  param([Parameter(Mandatory = $true)][scriptblock]$Command)
  & $Command 2>&1 | ForEach-Object {
    Add-LogLine -Line $_.ToString()
  }
  return $LASTEXITCODE
}

function Sync-Snapshots {
  $exitCode = Invoke-LoggedCommand { & git fetch origin main }
  if ($exitCode -ne 0) { return $exitCode }
  $exitCode = Invoke-LoggedCommand { & git merge --no-edit origin/main }
  if ($exitCode -eq 0) { return 0 }

  $conflicts = @(& git diff --name-only --diff-filter=U)
  $allowedFiles = @("data/$Target/latest.json", "data/$Target/previous.json", "data/$Target/ranking-state.json")
  if ($Target -eq "makoto") { $allowedFiles += "data/life-log-import.json" }
  if ($conflicts.Count -eq 0 -or @($conflicts | Where-Object { $_ -notin $allowedFiles }).Count -gt 0) {
    Add-LogLine "Sync failed; refusing to resolve conflicts outside this target's generated snapshots"
    return 1
  }

  Add-LogLine "Resolving generated snapshot conflicts using this watcher's notified state"
  $exitCode = Invoke-LoggedCommand { & git checkout --ours -- $conflicts }
  if ($exitCode -ne 0) { return $exitCode }
  $exitCode = Invoke-LoggedCommand { & git add -- $conflicts }
  if ($exitCode -ne 0) { return $exitCode }
  return Invoke-LoggedCommand { & git -c core.editor=true commit --no-edit }
}

# The hidden launcher returns immediately, so Task Scheduler alone cannot prevent overlap.
$mutex = New-Object System.Threading.Mutex($false, "Local\MakotoWatchBotRepository")
$locked = $false
try {
  try { $locked = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $locked = $true }
  if (-not $locked) {
    Add-LogLine "Another watcher is running; skipping overlapping run"
    exit 0
  }
  Add-LogLine "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')] starting $Target watch"
  if ((Test-Path ".git\rebase-merge") -or (Test-Path ".git\rebase-apply") -or (Test-Path ".git\MERGE_HEAD")) {
    throw "Unfinished Git operation; manual recovery required"
  }
  $stagedFiles = @(& git diff --cached --name-only)
  if ($stagedFiles.Count -gt 0) {
    throw "Existing staged changes; refusing to include them in automated snapshot commits"
  }

  $env:TARGET = $Target
  $exitCode = Invoke-LoggedCommand { & node --use-system-ca .\src\main.js }
  if ($exitCode -eq 0 -and $Target -eq "makoto") {
    $exitCode = Invoke-LoggedCommand { & npm.cmd run export:life-log }
  }
  if ($exitCode -eq 0) {
    $dataFiles = @("data/$Target")
    if ($Target -eq "makoto") { $dataFiles += "data/life-log-import.json" }
    $exitCode = Invoke-LoggedCommand { & git add -- $dataFiles }
    if ($exitCode -eq 0) {
      & git diff --cached --quiet -- $dataFiles
      if ($LASTEXITCODE -eq 0) {
        Add-LogLine "No data changes to commit"
      } else {
        $exitCode = Invoke-LoggedCommand { & git commit -m "chore: update $Target snapshots" }
      }
    }
    if ($exitCode -eq 0) {
      for ($attempt = 1; $attempt -le 3; $attempt++) {
        $exitCode = Sync-Snapshots
        if ($exitCode -ne 0) { break }
        $exitCode = Invoke-LoggedCommand { & git push origin HEAD:main }
        if ($exitCode -eq 0) { break }
        if ($attempt -lt 3) { Start-Sleep -Seconds 5 }
      }
    }
  }
} catch {
  Add-LogLine -Line ($_ | Out-String)
  $exitCode = 1
} finally {
  if ($locked) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
Add-LogLine "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')] finished $Target watch exit=$exitCode"
exit $exitCode