<#
.SYNOPSIS
  kppdf-ai-analyst - остановка процессов и опционально Docker.

.DESCRIPTION
  1. Завершает окна бэкенда и админки из .ai-analyst-dev.session.json
  2. Освобождает порты 3100 и 5174
  3. По умолчанию останавливает контейнеры Mongo и Qdrant (docker compose down)

.PARAMETER KeepDocker
  Не останавливать Docker-контейнеры (Mongo, Qdrant).

.EXAMPLE
  .\stop.ps1
  Остановить бэкенд и контейнеры Docker.

.EXAMPLE
  .\stop.ps1 -KeepDocker
  Остановить только бэкенд, оставить Mongo и Qdrant.
#>

param(
  [switch]$KeepDocker
)

$ErrorActionPreference = 'Continue'

$Root = $PSScriptRoot
$SessionFile = Join-Path $Root '.ai-analyst-dev.session.json'

Write-Host '========== kppdf-ai-analyst - остановка ==========' -ForegroundColor Cyan
Write-Host ''

function Get-PortPids([int]$Port) {
  $pids = @()
  try {
    $pids += Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  } catch { }

  if ($pids.Count -eq 0) {
    $pids += netstat -ano | Select-String ":$Port\s" | ForEach-Object {
      ($_.ToString() -split '\s+')[-1]
    } | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ }
  }

  return ($pids | Select-Object -Unique)
}

function Stop-Port([int]$Port, [string]$Label) {
  $pids = Get-PortPids -Port $Port
  if ($pids.Count -eq 0) {
    Write-Host "  [OK]   $Label - не запущен" -ForegroundColor Green
    return
  }

  foreach ($procId in $pids) {
    if ($procId -eq $PID) { continue }
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Host "  [СТОП] $Label на :$Port - $($proc.ProcessName) (PID $procId)" -ForegroundColor Yellow
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host '[1/2] Остановка процессов...' -ForegroundColor Gray

if (Test-Path $SessionFile) {
  try {
    $session = Get-Content $SessionFile -Raw | ConvertFrom-Json
    $windowPid = [int]$session.backendWindowPid
    if ($windowPid -gt 0) {
      $proc = Get-Process -Id $windowPid -ErrorAction SilentlyContinue
      if ($proc) {
        Write-Host "  [СТОП] окно бэкенда (PID $windowPid)" -ForegroundColor Yellow
        Stop-Process -Id $windowPid -Force -ErrorAction SilentlyContinue
      }
    }
    if ($session.adminWindowPid) {
      $adminPid = [int]$session.adminWindowPid
      if ($adminPid -gt 0) {
        $proc = Get-Process -Id $adminPid -ErrorAction SilentlyContinue
        if ($proc) {
          Write-Host "  [СТОП] окно админки (PID $adminPid)" -ForegroundColor Yellow
          Stop-Process -Id $adminPid -Force -ErrorAction SilentlyContinue
        }
      }
    }
  } catch { }
  Remove-Item $SessionFile -Force -ErrorAction SilentlyContinue
}

Stop-Port -Port 3100 -Label 'Бэкенд'
Stop-Port -Port 5174 -Label 'Админка'

try {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'tsx|kppdf-ai-analyst|backend\\src\\server|admin.*vite' } |
    ForEach-Object {
      $proc = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
      if ($proc) {
        Write-Host "  [СТОП] tsx watch (PID $($_.ProcessId))" -ForegroundColor Yellow
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      }
    }
} catch { }

Write-Host ''
if ($KeepDocker) {
  Write-Host '[2/2] Docker пропущен (-KeepDocker)' -ForegroundColor Gray
} else {
  Write-Host '[2/2] Остановка Docker (Mongo + Qdrant)...' -ForegroundColor Gray
  Push-Location $Root
  $null = docker compose down 2>$null
  Pop-Location
  if ($LASTEXITCODE -eq 0) {
    Write-Host '  [OK]   контейнеры остановлены' -ForegroundColor Green
  } else {
    Write-Host "  [ВНИМ] docker compose down завершился с кодом $LASTEXITCODE" -ForegroundColor Yellow
  }
}

Write-Host ''
Write-Host 'Готово.' -ForegroundColor Green
