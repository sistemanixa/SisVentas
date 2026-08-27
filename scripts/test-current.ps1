$ErrorActionPreference = 'Stop'

# Las pruebas incremental-* y release-* son instantáneas de publicaciones
# históricas. Verifican sus artefactos por separado y no deben exigir que una
# versión antigua continúe enlazada desde index.html o desde el Service Worker.
$currentTests = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '..\test') -Filter '*.test.js' |
  Where-Object { $_.Name -notmatch '^(incremental-|release-|v3-architecture\.test\.js$)' } |
  ForEach-Object { $_.FullName }

if (-not $currentTests) {
  throw 'No se encontraron pruebas de la versión actual.'
}

node --test $currentTests
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
