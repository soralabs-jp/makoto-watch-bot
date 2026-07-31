$ErrorActionPreference = "Continue"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $repoRoot "logs"
$logPath = Join-Path $logDir "watch.log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location $repoRoot

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
"[$timestamp] starting makoto watch" | Add-Content -Path $logPath -Encoding UTF8

function Add-LogLine {
  param([string]$Line)
  $Line | Add-Content -Path $logPath -Encoding UTF8
}

function Invoke-LoggedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  & $Command 2>&1 | ForEach-Object {
    $_.ToString() | Add-LogLine
  }

  return $LASTEXITCODE
}

function Test-RebaseInProgress {
  return (Test-Path ".git\rebase-merge") -or (Test-Path ".git\rebase-apply")
}

function Resolve-SnapshotRebase {
  if (-not (Test-RebaseInProgress)) {
    return 1
  }

  Add-LogLine "Resolving snapshot rebase conflict"
  $dataFiles = @(
    "data/latest.json",
    "data/previous.json",
    "data/ranking-state.json",
    "data/life-log-import.json"
  )

  $exitCode = Invoke-LoggedCommand { & git checkout --theirs -- $dataFiles }
  if ($exitCode -ne 0) {
    return $exitCode
  }

  $exitCode = Invoke-LoggedCommand { & git add -- $dataFiles }
  if ($exitCode -ne 0) {
    return $exitCode
  }

  return Invoke-LoggedCommand { & git -c core.editor=true rebase --continue }
}

try {
  $exitCode = Resolve-SnapshotRebase
  if ($exitCode -ne 0 -and (Test-RebaseInProgress)) {
    throw "Failed to resolve existing snapshot rebase"
  }

  $exitCode = Invoke-LoggedCommand { & node --use-system-ca .\src\main.js }
  if ($exitCode -eq 0) {
    $exitCode = Invoke-LoggedCommand { & npm.cmd run export:life-log }
  }

  if ($exitCode -eq 0) {
    $dataFiles = @(
      "data/latest.json",
      "data/previous.json",
      "data/ranking-state.json",
      "data/life-log-import.json"
    )

    $exitCode = Invoke-LoggedCommand { & git add -- $dataFiles }

    if ($exitCode -eq 0) {
      & git diff --cached --quiet -- $dataFiles
      if ($LASTEXITCODE -eq 0) {
        Add-LogLine "No data changes to publish"
      } else {
        $exitCode = Invoke-LoggedCommand { & git commit -m "chore: update makoto snapshots" }
        if ($exitCode -eq 0) {
          $exitCode = Invoke-LoggedCommand { & git -c rebase.autoStash=true pull --rebase origin main }
          if ($exitCode -ne 0) {
            $exitCode = Resolve-SnapshotRebase
          }
        }
        if ($exitCode -eq 0) {
          $exitCode = Invoke-LoggedCommand { & git push origin HEAD:main }
          if ($exitCode -ne 0) {
            Start-Sleep -Seconds 5
            $exitCode = Invoke-LoggedCommand { & git -c rebase.autoStash=true pull --rebase origin main }
            if ($exitCode -ne 0) {
              $exitCode = Resolve-SnapshotRebase
            }
            if ($exitCode -eq 0) {
              $exitCode = Invoke-LoggedCommand { & git push origin HEAD:main }
            }
          }
        }
      }
    }
  }
} catch {
  $_ | Out-String | Add-Content -Path $logPath -Encoding UTF8
  $exitCode = 1
}

$finishedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
"[$finishedAt] finished makoto watch exit=$exitCode" | Add-Content -Path $logPath -Encoding UTF8

exit $exitCode
