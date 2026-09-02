param([switch]$Apply, [switch]$Restore)

$ErrorActionPreference = 'Stop'
$gcloud = 'C:\Users\gon_s\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
if (!(Test-Path -LiteralPath $gcloud)) { throw 'No se encontro Google Cloud SDK.' }
$token = & $gcloud auth print-access-token
if (!$token) { throw 'No se pudo obtener autenticacion.' }
$headers = @{ Authorization = "Bearer $token" }
$root = 'https://nixa-sisventas-default-rtdb.firebaseio.com/sisventas'
if ($Restore) {
  $adjuntos = Invoke-RestMethod -Headers $headers -Uri "$root/gastos_adjuntos.json" -TimeoutSec 90
  $restauracion = [ordered]@{}
  foreach ($item in @($adjuntos.PSObject.Properties)) {
    if ($item.Value.fotoBase64 -is [string] -and $item.Value.fotoBase64.Length -gt 0) {
      $restauracion["gastos/$($item.Name)/fotoBase64"] = $item.Value.fotoBase64
    }
  }
  if ($restauracion.Count) {
    $bodyRestauracion = $restauracion | ConvertTo-Json -Depth 5 -Compress
    Invoke-RestMethod -Method Patch -Headers $headers -ContentType 'application/json' -Uri "$root.json" -Body $bodyRestauracion -TimeoutSec 180 | Out-Null
  }
  Write-Output "Restauracion compatible completa: $($restauracion.Count) adjuntos volvieron al listado principal."
  exit 0
}
$gastos = Invoke-RestMethod -Headers $headers -Uri "$root/gastos.json" -TimeoutSec 60
$candidatos = @($gastos.PSObject.Properties | Where-Object { $_.Value.fotoBase64 -is [string] -and $_.Value.fotoBase64.Length -gt 0 })
$bytes = ($candidatos | ForEach-Object { $_.Value.fotoBase64.Length } | Measure-Object -Sum).Sum
Write-Output "Adjuntos encontrados: $($candidatos.Count)"
Write-Output "Peso que saldra del listado: $([math]::Round($bytes / 1MB, 2)) MB"
if (!$Apply -or !$candidatos.Count) { Write-Output 'Vista previa: no se modificaron datos.'; exit 0 }

$copias = [ordered]@{}
foreach ($item in $candidatos) {
  $key = $item.Name
  $copias["gastos_adjuntos/$key/fotoBase64"] = $item.Value.fotoBase64
  $copias["gastos/$key/fotoAdjunta"] = $true
}
$bodyCopias = $copias | ConvertTo-Json -Depth 5 -Compress
Invoke-RestMethod -Method Patch -Headers $headers -ContentType 'application/json' -Uri "$root.json" -Body $bodyCopias -TimeoutSec 180 | Out-Null

$clavesAdjuntas = Invoke-RestMethod -Headers $headers -Uri "$root/gastos_adjuntos.json?shallow=true" -TimeoutSec 60
$existentes = @($clavesAdjuntas.PSObject.Properties.Name)
$faltantes = @($candidatos | Where-Object { $existentes -notcontains $_.Name })
if ($faltantes.Count) { throw "La copia no se verifico para $($faltantes.Count) gastos; no se elimino ningun original." }

$limpieza = [ordered]@{}
foreach ($item in $candidatos) { $limpieza["gastos/$($item.Name)/fotoBase64"] = $null }
$bodyLimpieza = $limpieza | ConvertTo-Json -Depth 3 -Compress
Invoke-RestMethod -Method Patch -Headers $headers -ContentType 'application/json' -Uri "$root.json" -Body $bodyLimpieza -TimeoutSec 120 | Out-Null
Write-Output "Migracion completa: $($candidatos.Count) adjuntos copiados, verificados y retirados del listado pesado."
