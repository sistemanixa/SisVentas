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
$pagosCandidatos = @()
foreach ($gastoProp in @($gastos.PSObject.Properties)) {
  $pagos = $gastoProp.Value.pagos
  if ($null -eq $pagos) { continue }
  $propiedadesPagos = if ($pagos -is [array]) {
    for ($i = 0; $i -lt $pagos.Count; $i++) { [pscustomobject]@{ Name = [string]$i; Value = $pagos[$i] } }
  } else { @($pagos.PSObject.Properties) }
  foreach ($pagoProp in @($propiedadesPagos)) {
    $comp = $pagoProp.Value.comprobante
    if ($comp -and $comp.data -is [string] -and $comp.data.Length -gt 0) {
      $pagosCandidatos += [pscustomobject]@{ GastoKey=$gastoProp.Name; PagoKey=$pagoProp.Name; Data=$comp.data; Nombre=$comp.nombre; Tipo=$comp.tipo }
    }
  }
}
$bytes = (($candidatos | ForEach-Object { $_.Value.fotoBase64.Length }) + ($pagosCandidatos | ForEach-Object { $_.Data.Length }) | Measure-Object -Sum).Sum
Write-Output "Adjuntos encontrados: $($candidatos.Count)"
Write-Output "Comprobantes de pagos encontrados: $($pagosCandidatos.Count)"
Write-Output "Peso que saldra del listado: $([math]::Round($bytes / 1MB, 2)) MB"
if (!$Apply -or (!$candidatos.Count -and !$pagosCandidatos.Count)) { Write-Output 'Vista previa: no se modificaron datos.'; exit 0 }

$copias = [ordered]@{}
foreach ($item in $candidatos) {
  $key = $item.Name
  $copias["gastos_adjuntos/$key/fotoBase64"] = $item.Value.fotoBase64
  $copias["gastos/$key/fotoAdjunta"] = $true
}
foreach ($pago in $pagosCandidatos) {
  $base = "gastos_adjuntos/$($pago.GastoKey)/pagos/$($pago.PagoKey)"
  $copias["$base/comprobanteData"] = $pago.Data
}
$bodyCopias = $copias | ConvertTo-Json -Depth 5 -Compress
Invoke-RestMethod -Method Patch -Headers $headers -ContentType 'application/json' -Uri "$root.json" -Body $bodyCopias -TimeoutSec 180 | Out-Null

$adjuntosVerificados = Invoke-RestMethod -Headers $headers -Uri "$root/gastos_adjuntos.json" -TimeoutSec 120
$existentes = @($adjuntosVerificados.PSObject.Properties.Name)
$faltantes = @($candidatos | Where-Object { $existentes -notcontains $_.Name })
$pagosFaltantes = @($pagosCandidatos | Where-Object {
  $gastoAdjunto = $adjuntosVerificados.PSObject.Properties[$_.GastoKey].Value
  $pagosAdjuntos = if ($gastoAdjunto) { $gastoAdjunto.pagos } else { $null }
  $pagoAdjunto = if ($pagosAdjuntos) { $pagosAdjuntos.PSObject.Properties[$_.PagoKey].Value } else { $null }
  -not ($pagoAdjunto -and $pagoAdjunto.comprobanteData -is [string] -and $pagoAdjunto.comprobanteData.Length -eq $_.Data.Length)
})
if ($faltantes.Count -or $pagosFaltantes.Count) { throw "La copia no se verifico para $($faltantes.Count) gastos y $($pagosFaltantes.Count) pagos; no se elimino ningun original." }

$limpieza = [ordered]@{}
foreach ($item in $candidatos) { $limpieza["gastos/$($item.Name)/fotoBase64"] = $null }
foreach ($pago in $pagosCandidatos) {
  $base = "gastos/$($pago.GastoKey)/pagos/$($pago.PagoKey)/comprobante"
  $limpieza["$base/data"] = $null
  $limpieza["$base/externo"] = $true
}
$bodyLimpieza = $limpieza | ConvertTo-Json -Depth 3 -Compress
Invoke-RestMethod -Method Patch -Headers $headers -ContentType 'application/json' -Uri "$root.json" -Body $bodyLimpieza -TimeoutSec 120 | Out-Null
Write-Output "Migracion completa: $($candidatos.Count) adjuntos y $($pagosCandidatos.Count) comprobantes de pagos copiados, verificados y retirados del listado pesado."
