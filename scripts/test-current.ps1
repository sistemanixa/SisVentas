param([switch]$IncludeBrowser)
$ErrorActionPreference = 'Stop'

# Las instantáneas históricas se ejecutan por separado.
$currentTests = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '..\test') -File |
  Where-Object { $_.Name -match '\.test\.(js|cjs)$' } |
  Where-Object { $_.Name -notmatch '^(incremental-|release-|v3-architecture\.test\.js$)' } |
  Where-Object { $IncludeBrowser -or $_.Name -ne 'catalogo-clientes-v330.test.js' } |
  ForEach-Object { $_.FullName }

if (-not $currentTests) { throw 'No se encontraron pruebas de la versión actual.' }
if (-not $IncludeBrowser) { Write-Host 'Prueba de navegador separada: usar -IncludeBrowser con Playwright y Chrome; usa archivos y datos aislados.' }
node --test $currentTests
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
