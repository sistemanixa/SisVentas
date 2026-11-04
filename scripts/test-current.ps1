param([switch]$IncludeBrowser, [ValidateRange(1,16)][int]$TestConcurrency = 4)
$ErrorActionPreference = 'Stop'

# Las instantáneas históricas se ejecutan por separado.
$currentTests = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '..\test') -File |
  Where-Object { $_.Name -match '\.test\.(js|cjs)$' } |
  Where-Object { $_.Name -notmatch '^(incremental-|release-|v3-architecture\.test\.js$)' } |
  Where-Object { $IncludeBrowser -or $_.Name -ne 'catalogo-clientes-v330.test.js' } |
  ForEach-Object { Join-Path 'test' $_.Name }

if (-not $currentTests) { throw 'No se encontraron pruebas de la versión actual.' }
if (-not $IncludeBrowser) { Write-Host 'Prueba de navegador separada: usar -IncludeBrowser con Playwright y Chrome; usa archivos y datos aislados.' }
Push-Location (Join-Path $PSScriptRoot '..')
try {
  # El inventario vigente ya supera el límite de argumentos de Windows.
  # Ejecutar todos los archivos en lotes conserva exactamente la selección.
  # Limitar procesos evita que las pruebas nativas compitan con decenas de Chrome.
  # Se conserva la misma selección completa; no se omiten archivos.
  $currentSuiteExit = 0
  $batch = @()
  $batchLength = 0
  foreach ($testFile in $currentTests) {
    if ($batch.Count -gt 0 -and ($batchLength + $testFile.Length + 3) -gt 12000) {
      Write-Host "Pruebas vigentes: lote de $($batch.Count) archivos"
      node --test --test-concurrency=$TestConcurrency $batch
      if ($LASTEXITCODE -ne 0) { $currentSuiteExit = $LASTEXITCODE }
      $batch = @()
      $batchLength = 0
    }
    $batch += $testFile
    $batchLength += $testFile.Length + 3
  }
  if ($batch.Count -gt 0) {
    Write-Host "Pruebas vigentes: lote de $($batch.Count) archivos"
    node --test --test-concurrency=$TestConcurrency $batch
    if ($LASTEXITCODE -ne 0) { $currentSuiteExit = $LASTEXITCODE }
  }
} finally { Pop-Location }
if ($currentSuiteExit -ne 0) { exit $currentSuiteExit }
