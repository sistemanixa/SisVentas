param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$gcloud = 'C:\Users\gon_s\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
if (-not (Test-Path -LiteralPath $gcloud)) { throw 'No se encontró gcloud.' }
$token = & cmd.exe /d /c ('"' + $gcloud + '" auth print-access-token')
if (-not $token) { throw 'No se pudo obtener un token de Google Cloud.' }
$headers = @{ Authorization = "Bearer $token" }
$url = 'https://nixa-sisventas-default-rtdb.firebaseio.com/sisventas/productos.json'
$productos = Invoke-RestMethod -Headers $headers -Uri $url -Method Get -TimeoutSec 60
$cambios = @{}
$respaldo = @{}
$base64Total = 0
$base64SinOriginal = 0

foreach ($propiedad in $productos.PSObject.Properties) {
  $clave = $propiedad.Name
  $producto = $propiedad.Value
  $actual = [string]$producto.imagenUrl
  $original = [string]$producto.imagenUrlOriginal
  if ($actual.StartsWith('data:image/')) {
    $base64Total++
    if ($original -notmatch '^https?://') { $base64SinOriginal++ }
  }
  if ($actual.StartsWith('data:image/') -and $original -match '^https?://') {
    $respaldo[$clave] = @{
      imagenUrl = $actual
      imagenUrlOriginal = $original
      imagenGuardadaMetodo = $producto.imagenGuardadaMetodo
      imagenGuardadaEn = $producto.imagenGuardadaEn
      imagenGuardadaBytes = $producto.imagenGuardadaBytes
    }
    $cambios["$clave/imagenUrl"] = $original
    $cambios["$clave/imagenGuardadaMetodo"] = $null
    $cambios["$clave/imagenGuardadaEn"] = $null
    $cambios["$clave/imagenGuardadaBytes"] = $null
  }
}

$bytes = ($respaldo.Values | ForEach-Object { ([string]$_.imagenUrl).Length } | Measure-Object -Sum).Sum
Write-Output ("PRODUCTOS_A_MIGRAR=" + $respaldo.Count)
Write-Output ("BASE64_TOTAL=" + $base64Total)
Write-Output ("BASE64_SIN_ORIGINAL=" + $base64SinOriginal)
Write-Output ("BASE64_CHARS=" + $bytes)
if (-not $Apply) { Write-Output 'DRY_RUN=1'; exit 0 }
if ($respaldo.Count -eq 0) { Write-Output 'SIN_CAMBIOS=1'; exit 0 }

$carpeta = Join-Path $PSScriptRoot '..\tmp\backups'
New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
$marca = Get-Date -Format 'yyyyMMdd-HHmmss'
$archivo = Join-Path $carpeta "productos-imagenes-base64-$marca.json"
$respaldo | ConvertTo-Json -Depth 8 -Compress | Set-Content -LiteralPath $archivo -Encoding utf8
Invoke-RestMethod -Headers $headers -Uri $url -Method Patch -ContentType 'application/json; charset=utf-8' -Body ($cambios | ConvertTo-Json -Depth 5 -Compress) -TimeoutSec 120 | Out-Null
Write-Output ("APLICADOS=" + $respaldo.Count)
Write-Output ("RESPALDO=" + (Resolve-Path -LiteralPath $archivo).Path)
