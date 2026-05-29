<#
.SYNOPSIS
  kppdf-ai-analyst - локальный запуск одной командой (Windows).

.EXAMPLE
  .\start.ps1
  .\start.cmd
  Docker MongoDB + Qdrant + backend :3100 + admin :5174.

.EXAMPLE
  .\start.ps1 -SkipDocker
  Без Docker — Mongo (:27018) и Qdrant (:6333) должны быть запущены вручную.

.EXAMPLE
  .\start.ps1 -NoInstall
  Пропустить npm install в backend/ и admin/.

.EXAMPLE
  .\start.ps1 -NoAdmin
  Только backend, без админки :5174.
#>

param(
  [switch]$SkipDocker,
  [switch]$NoInstall,
  [switch]$NoAdmin
)

$ErrorActionPreference = 'Continue'

$Root = $PSScriptRoot
$BackendDir = Join-Path $Root 'backend'
$AdminDir = Join-Path $Root 'admin'
$HealthUrl = 'http://127.0.0.1:3100/v1/health'
$AdminUrl = 'http://127.0.0.1:5174'
$SessionFile = Join-Path $Root '.ai-analyst-dev.session.json'

# -- Helpers ---------------------------------------------------

function Stop-DevProcess([int]$ProcessId, [string]$Label) {
  if ($ProcessId -le 0 -or $ProcessId -eq $PID) { return }
  $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $proc) { return }
  Write-Host "  закрыть $Label (PID $ProcessId, $($proc.ProcessName))" -ForegroundColor Yellow
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Stop-LingeringDevProcesses {
  try {
    Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -match 'tsx|kppdf-ai-analyst|backend\\src\\server' } |
      ForEach-Object {
        Write-Host "  остановить node (PID $($_.ProcessId))" -ForegroundColor Yellow
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      }
  } catch { }
}

function Stop-PreviousDevSessions {
  Write-Host '  закрытие предыдущих окон разработки...' -ForegroundColor Gray

  if (Test-Path $SessionFile) {
    try {
      $session = Get-Content $SessionFile -Raw | ConvertFrom-Json
      Stop-DevProcess -ProcessId ([int]$session.backendWindowPid) -Label 'окно бэкенда'
      if ($session.adminWindowPid) {
        Stop-DevProcess -ProcessId ([int]$session.adminWindowPid) -Label 'окно админки'
      }
    } catch {
      Write-Host '  файл сессии не читается, пропуск' -ForegroundColor DarkYellow
    }
    Remove-Item $SessionFile -Force -ErrorAction SilentlyContinue
  }

  Stop-Port -Port 3100
  Stop-Port -Port 5174
  Stop-LingeringDevProcesses
  Start-Sleep -Milliseconds 400
}

function Save-DevSession([int]$BackendWindowPid, [int]$AdminWindowPid = 0) {
  @{
    backendWindowPid = $BackendWindowPid
    adminWindowPid   = $AdminWindowPid
    startedAt        = (Get-Date).ToString('o')
  } | ConvertTo-Json | Set-Content $SessionFile -Encoding UTF8
}

function Write-Step([string]$Text) {
  Write-Host $Text -ForegroundColor Gray
}

function Test-HttpOk([string]$Url) {
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    return ($r.StatusCode -eq 200)
  } catch {
    return $false
  }
}

function Test-TcpOpen([int]$Port, [int]$TimeoutMs = 300) {
  $client = $null
  try {
    $client = [System.Net.Sockets.TcpClient]::new()
    $task = $client.ConnectAsync('127.0.0.1', $Port)
    if (-not $task.Wait($TimeoutMs)) { return $false }
    return $client.Connected
  } catch {
    return $false
  } finally {
    if ($client) { $client.Dispose() }
  }
}

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

function Stop-Port([int]$Port) {
  $pids = Get-PortPids -Port $Port
  if ($pids.Count -eq 0) {
    Write-Host "  :$Port свободен" -ForegroundColor Green
    return
  }

  foreach ($procId in $pids) {
    if ($procId -eq $PID) { continue }
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Host "  :$Port остановка $($proc.ProcessName) (PID $procId)" -ForegroundColor Yellow
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Wait-Http([string]$Url, [string]$Label, [int]$Seconds = 90) {
  if (Test-HttpOk -Url $Url) {
    Write-Host "  $Label готов" -ForegroundColor Green
    return $true
  }

  Write-Host "  ожидание $Label..." -NoNewline
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpOk -Url $Url) {
      Write-Host ' OK' -ForegroundColor Green
      return $true
    }
    Start-Sleep -Milliseconds 800
    Write-Host '.' -NoNewline
  }
  Write-Host ' ТАЙМАУТ' -ForegroundColor Red
  Write-Host "  URL: $Url" -ForegroundColor DarkYellow
  return $false
}

function Wait-TcpPort([int]$Port, [string]$Label, [int]$Seconds = 60) {
  if (Test-TcpOpen -Port $Port) {
    Write-Host "  $Label готов" -ForegroundColor Green
    return $true
  }

  Write-Host "  ожидание $Label..." -NoNewline
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-TcpOpen -Port $Port) {
      Write-Host ' OK' -ForegroundColor Green
      return $true
    }
    Start-Sleep -Milliseconds 500
    Write-Host '.' -NoNewline
  }
  Write-Host ' ТАЙМАУТ' -ForegroundColor Red
  return $false
}

function Ensure-NodeModules([string]$Dir, [string]$Label) {
  if (Test-Path (Join-Path $Dir 'node_modules')) {
    Write-Host "  $Label - OK" -ForegroundColor Green
    return
  }
  Write-Host "  $Label - npm install..." -ForegroundColor Yellow
  Push-Location $Dir
  $null = npm install 2>$null
  Pop-Location
}

function Ensure-EnvFile {
  $envFile = Join-Path $Root '.env'
  $example = Join-Path $Root '.env.example'

  if (-not (Test-Path $envFile)) {
    if (-not (Test-Path $example)) {
      Write-Host '  .env.example не найден' -ForegroundColor Red
      return $false
    }
    Copy-Item $example $envFile
    Write-Host '  создан .env из .env.example' -ForegroundColor Green
    return $true
  }

  # Дописать отсутствующие ключи из .env.example (например ADMIN_*)
  if (Test-Path $example) {
    $existing = Get-Content $envFile -Raw
    $added = @()
    foreach ($line in Get-Content $example) {
      if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
      if ($line -match '^([A-Z_][A-Z0-9_]*)=') {
        $key = $Matches[1]
        if ($existing -notmatch "(?m)^$key=") {
          Add-Content -Path $envFile -Value $line -Encoding UTF8
          $added += $key
        }
      }
    }
    if ($added.Count -gt 0) {
      Write-Host "  .env дополнен: $($added -join ', ')" -ForegroundColor Yellow
    }
  }

  Write-Host '  .env - OK' -ForegroundColor Green
  return $true
}

function Test-MongoDockerOk {
  $status = docker inspect -f '{{.State.Status}}' ai-analyst-mongo 2>$null
  if ($LASTEXITCODE -ne 0 -or $status -ne 'running') { return $false }
  return (Test-TcpOpen -Port 27018)
}

function Test-QdrantDockerOk {
  $status = docker inspect -f '{{.State.Status}}' ai-analyst-qdrant 2>$null
  if ($LASTEXITCODE -ne 0 -or $status -ne 'running') { return $false }
  return (Test-TcpOpen -Port 6333)
}

function Ensure-DockerStack {
  Push-Location $Root
  try {
    if ((Test-MongoDockerOk) -and (Test-QdrantDockerOk)) {
      Write-Host '  Mongo + Qdrant - OK (уже запущены)' -ForegroundColor Green
      return $true
    }

    Write-Host '  docker compose up -d' -ForegroundColor Yellow
    $out = docker compose up -d 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
      Write-Host $out -ForegroundColor Red
      return $false
    }

    $mongoOk = Wait-TcpPort -Port 27018 -Label 'MongoDB :27018'
    $qdrantOk = Wait-TcpPort -Port 6333 -Label 'Qdrant :6333'
    return ($mongoOk -and $qdrantOk)
  } finally {
    Pop-Location
  }
}

function Start-Admin {
  $cmd = @"
`$Host.UI.RawUI.WindowTitle = 'KPPDF AI — админка'
Set-Location '$AdminDir'
Write-Host 'Админка: http://127.0.0.1:5174' -ForegroundColor Cyan
npm run dev
"@
  $proc = Start-Process -WindowStyle Normal -FilePath 'powershell' -ArgumentList @(
    '-NoExit', '-NoProfile', '-Command', $cmd
  ) -PassThru
  Write-Host "  admin npm run dev (окно PID $($proc.Id))" -ForegroundColor Green
  return $proc.Id
}

function Start-Backend {
  $cmd = @"
`$Host.UI.RawUI.WindowTitle = 'KPPDF AI — бэкенд'
Set-Location '$BackendDir'
Write-Host 'Бэкенд: http://127.0.0.1:3100/v1/health' -ForegroundColor Cyan
npm run dev
"@
  $proc = Start-Process -WindowStyle Normal -FilePath 'powershell' -ArgumentList @(
    '-NoExit', '-NoProfile', '-Command', $cmd
  ) -PassThru
  Write-Host "  npm run dev (окно PID $($proc.Id))" -ForegroundColor Green
  return $proc.Id
}

function Show-Ready([bool]$WithAdminUi) {
  Write-Host ''
  Write-Host '====== kppdf-ai-analyst готов ======' -ForegroundColor Cyan
  Write-Host '  Бэкенд: http://127.0.0.1:3100/v1/health' -ForegroundColor White
  if ($WithAdminUi) {
    Write-Host '  Админка: http://127.0.0.1:5174' -ForegroundColor White
    Write-Host '  Вход: ADMIN_USERNAME / ADMIN_PASSWORD в .env' -ForegroundColor Gray
  }
  Write-Host ''
  Write-Host '  KPPDF :3000 запускайте отдельно (kppdf-3.0) для sync.' -ForegroundColor Yellow
  Write-Host '====================================' -ForegroundColor Cyan
  if ($WithAdminUi) {
    Start-Process $AdminUrl
  }
}

# -- Main ------------------------------------------------------

Write-Host ''
Write-Host '========== kppdf-ai-analyst ==========' -ForegroundColor Cyan
Write-Host ''

Write-Step '[1/6] Закрытие предыдущей сессии'
Stop-PreviousDevSessions
Write-Host ''

Write-Step '[2/6] Зависимости и .env'
if ($NoInstall) {
  Write-Host '  npm install пропущен (-NoInstall)' -ForegroundColor DarkYellow
} else {
  Ensure-NodeModules -Dir $BackendDir -Label 'Бэкенд'
  if (-not $NoAdmin) {
    Ensure-NodeModules -Dir $AdminDir -Label 'Админка'
  }
}
if (-not (Ensure-EnvFile)) { exit 1 }
Write-Host ''

Write-Step '[3/6] Docker (Mongo + Qdrant)'
$infraOk = $true
if ($SkipDocker) {
  Write-Host '  -SkipDocker: Mongo (:27018) и Qdrant (:6333) должны быть доступны вручную' -ForegroundColor Yellow
  if (-not (Test-TcpOpen -Port 27018)) {
    Write-Host '  MongoDB :27018 недоступен' -ForegroundColor Red
    $infraOk = $false
  } else {
    Write-Host '  MongoDB :27018 - OK' -ForegroundColor Green
  }
  if (-not (Test-TcpOpen -Port 6333)) {
    Write-Host '  Qdrant :6333 недоступен' -ForegroundColor Red
    $infraOk = $false
  } else {
    Write-Host '  Qdrant :6333 - OK' -ForegroundColor Green
  }
} else {
  $infraOk = Ensure-DockerStack
}
Write-Host ''

if (-not $infraOk) {
  Write-Host 'Инфраструктура не готова. Исправьте Docker или уберите -SkipDocker.' -ForegroundColor Red
  exit 1
}

Write-Step '[4/6] Запуск сервисов'
Stop-Port -Port 3100
$backendWindowPid = Start-Backend
$adminWindowPid = 0
if (-not $NoAdmin) {
  Stop-Port -Port 5174
  $adminWindowPid = Start-Admin
}
Save-DevSession -BackendWindowPid $backendWindowPid -AdminWindowPid $adminWindowPid
Write-Host ''

Write-Step '[5/6] Ожидание backend'
$backendOk = Wait-Http -Url $HealthUrl -Label 'бэкенда' -Seconds 90
Write-Host ''

$adminOk = $true
if (-not $NoAdmin) {
  Write-Step '[6/6] Ожидание админки'
  $adminOk = Wait-Http -Url $AdminUrl -Label 'админки' -Seconds 120
  Write-Host ''
}

if ($backendOk) {
  if (-not $NoAdmin -and -not $adminOk) {
    Write-Host 'Админка ещё собирается — откройте http://127.0.0.1:5174 через минуту.' -ForegroundColor Yellow
  }
  Show-Ready -WithAdminUi:(-not $NoAdmin)
} else {
  Write-Host 'Бэкенд не готов. Исправьте ошибки в окне бэкенда и снова запустите .\start.ps1' -ForegroundColor Red
}

Write-Host ''
Write-Host 'Остановка: .\stop.ps1' -ForegroundColor Gray
Write-Host ''
