#Requires -Version 5.1
<#
.SYNOPSIS
  Roadmap Platform — Windows setup: .env, npm install, Docker (Postgres + Redis), Prisma db push.

.DESCRIPTION
  Mirrors scripts/setup.sh for PowerShell. Prerequisites:
  - Node.js LTS + npm (https://nodejs.org/)
  - Docker Desktop for Windows (WSL2 backend recommended), running before you start
  - Git for Windows (optional but recommended: provides `bash` for npm scripts like db:setup:local)

.PARAMETER LocalPostgres
  When creating a new .env from .env.example, tune for Postgres on the host (port 5432) and Redis in Docker only.

.PARAMETER SkipDocker
  Do not run docker compose; you must have Postgres and Redis already listening.

.PARAMETER NoInstall
  Skip npm install.

.PARAMETER SkipDbPush
  Skip npm run db:push:all.

.EXAMPLE
  .\scripts\setup.ps1
.EXAMPLE
  .\scripts\setup.ps1 -LocalPostgres
#>
[CmdletBinding()]
param(
  [switch] $LocalPostgres,
  [switch] $SkipDocker,
  [switch] $NoInstall,
  [switch] $SkipDbPush
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Write-Info([string] $Message) {
  Write-Host "==> $Message"
}

function Import-DotEnv {
  param([string] $Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.TrimEnd()
    if ($line -match "^\s*#" -or $line -eq "") { return }
    if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$") {
      $key = $Matches[1]
      $val = $Matches[2].Trim()
      if ($val.Length -ge 2 -and $val.StartsWith('"') -and $val.EndsWith('"')) {
        $val = $val.Substring(1, $val.Length - 2)
      }
      Set-Item -Path "Env:$key" -Value $val
    }
  }
}

function Apply-LocalPostgresEnv([string] $EnvPath) {
  $lines = Get-Content -LiteralPath $EnvPath
  $out = $lines | ForEach-Object {
    $l = $_
    if ($l -match '^# LOCAL_POSTGRES=1$') { return 'LOCAL_POSTGRES=1' }
    if ($l -match '^POSTGRES_PORT=5433$') { return 'POSTGRES_PORT=5432' }
    $l = $l -replace 'localhost:5433', 'localhost:5432'
    return $l
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines($EnvPath, @($out), $utf8NoBom)
}

$createdEnv = $false
if (-not (Test-Path -LiteralPath "$Root\.env")) {
  if (-not (Test-Path -LiteralPath "$Root\.env.example")) {
    Write-Error "Missing .env.example at repo root."
    exit 1
  }
  Copy-Item -LiteralPath "$Root\.env.example" -Destination "$Root\.env"
  $createdEnv = $true
  Write-Info "Created .env from .env.example"
  if ($LocalPostgres) {
    Apply-LocalPostgresEnv "$Root\.env"
    Write-Info "Tuned .env for local Postgres (LOCAL_POSTGRES=1, port 5432)"
  }
}
elseif ($LocalPostgres) {
  Write-Host "==> Note: .env already exists; not auto-editing. Set LOCAL_POSTGRES=1 and matching URLs if you use host Postgres."
}

if (-not $NoInstall) {
  Write-Info "npm install"
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
else {
  Write-Info "Skipping npm install (-NoInstall)"
}

Import-DotEnv "$Root\.env"

function Test-TcpOpen {
  param([string] $HostName = "127.0.0.1", [int] $Port)
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.Connect($HostName, $Port)
    $c.Close()
    return $true
  }
  catch {
    return $false
  }
}

function Wait-Postgres {
  param([int] $TimeoutSec = 90)
  $port = 5433
  if ($env:POSTGRES_PORT) { $port = [int]$env:POSTGRES_PORT }
  Write-Info "Waiting for Postgres on 127.0.0.1:$port..."
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-TcpOpen -Port $port) {
      Write-Host "    Postgres is accepting connections."
      return
    }
    Start-Sleep -Seconds 1
  }
  Write-Error "Postgres did not become ready on 127.0.0.1:$port within ${TimeoutSec}s."
  exit 1
}

function Wait-Redis {
  param([int] $TimeoutSec = 60)
  Write-Info "Waiting for Redis on 127.0.0.1:6379..."
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-TcpOpen -Port 6379) {
      Write-Host "    Redis is accepting connections."
      return
    }
    Start-Sleep -Seconds 1
  }
  Write-Error "Redis did not open port 6379 within ${TimeoutSec}s."
  exit 1
}

function Test-DockerAvailable {
  docker info 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host @"
Error: Docker is not available (daemon not reachable).

  • Start Docker Desktop for Windows and retry.
  • Or re-run with -SkipDocker if Postgres and Redis already run on this machine.
"@ -ForegroundColor Red
    exit 1
  }
}

function Get-DockerDbServices {
  if ($env:LOCAL_POSTGRES -eq "1") { return @("redis") }
  return @("postgres", "redis")
}

if (-not $SkipDocker) {
  Test-DockerAvailable
  $svc = Get-DockerDbServices
  Write-Info "docker compose up -d $($svc -join ' ')"
  & docker compose -f "$Root\docker-compose.yml" up -d @svc
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & docker compose -f "$Root\docker-compose.yml" ps
}
else {
  $pp = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5433" }
  Write-Info "Skipping Docker (-SkipDocker); ensure Postgres (port $pp) and Redis (6379) are up."
}

$needsPgWait = (-not $SkipDbPush) -or ($env:LOCAL_POSTGRES -eq "1")
if ($needsPgWait) {
  Wait-Postgres
}

if (-not $SkipDocker) {
  Wait-Redis
}
elseif (-not $SkipDbPush) {
  Write-Info "Checking Redis on 127.0.0.1:6379 (-SkipDocker; best-effort)"
  if (-not (Test-TcpOpen -Port 6379)) {
    Write-Warning "Nothing listening on 6379 — worker/BullMQ needs Redis. Start it before npm run dev."
  }
}

if ($env:LOCAL_POSTGRES -eq "1") {
  $bash = Get-Command bash -ErrorAction SilentlyContinue
  if ($bash) {
    Write-Info "Local Postgres: npm run db:setup:local"
    npm run db:setup:local
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  else {
    Write-Warning "bash not found (install Git for Windows). Run manually after configuring Postgres: npm run db:setup:local"
  }
}

if (-not $SkipDbPush) {
  Write-Info "Prisma: npm run db:push:all"
  npm run db:push:all
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
else {
  Write-Info "Skipped db push (-SkipDbPush)"
}

Write-Host @"

==> Setup finished.

Next (optional):
  • Seed portfolio DB:  npm run db:seed -w @roadmap/portfolio-service
  • Run the stack:      npm run dev
                        or  npm start   (Docker + turbo dev)

See README.md for details.
"@
