param([switch]$SkipDatabase)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$pgBin = if ($env:PG_BIN) { $env:PG_BIN } else { Join-Path $env:LOCALAPPDATA 'Programs\PostgreSQL18\pgsql\bin' }
if (-not $SkipDatabase) {
  & (Join-Path $pgBin 'pg_isready.exe') -h 127.0.0.1 -p 55432 -q
  if ($LASTEXITCODE -ne 0) {
    $cluster = Join-Path $projectRoot '.local\postgres'
    if (-not (Test-Path -LiteralPath (Join-Path $cluster 'PG_VERSION'))) { throw 'Yerel PostgreSQL kumesi bulunamadi.' }
    & (Join-Path $pgBin 'pg_ctl.exe') -D $cluster -l (Join-Path $projectRoot '.local\postgres.log') -o '-h 127.0.0.1 -p 55432' start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL baslatilamadi.' }
  }
}
try {
  $health = Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 3
  if ($health.status -eq 'ok') { Write-Output 'VILA zaten calisiyor: http://localhost:3000'; exit 0 }
} catch {}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.next\BUILD_ID'))) { throw 'Once npm run build calistirin.' }
Write-Output 'VILA: http://localhost:3000 - Durdurmak icin Ctrl+C'
npm start
