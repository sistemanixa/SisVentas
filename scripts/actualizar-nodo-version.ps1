param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^v\d+\.\d+\.\d+$')]
  [string]$Version
)

$ErrorActionPreference = 'Stop'
$versionFirebase = "$Version-firebase"
$sitio = 'https://ventas.sistemanixa.com'
$marca = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$headersNoCache = @{ 'Cache-Control' = 'no-cache'; 'Pragma' = 'no-cache' }

function Obtener-TextoPublico([string]$ruta) {
  $separador = if ($ruta.Contains('?')) { '&' } else { '?' }
  $respuesta = Invoke-WebRequest -UseBasicParsing -Headers $headersNoCache "$sitio/$ruta${separador}_verify=$marca"
  if ($respuesta.StatusCode -ne 200) { throw "No se pudo leer $ruta" }
  return $respuesta.Content
}

$index = Obtener-TextoPublico 'index.html'
if ($index -notmatch "VERSION:\s*'$([regex]::Escape($versionFirebase))'") {
  throw "index.html todavía no publica $versionFirebase"
}

$appRuta = ([regex]::Match($index, 'src=\"\./(js/app\.v[0-9.]+\.js(?:\?[^"]*)?)\"')).Groups[1].Value
if (-not $appRuta) {
  $appRuta = ([regex]::Match($index, "src='\./(js/app\.v[0-9.]+\.js(?:\?[^']*)?)'")).Groups[1].Value
}
$coreRuta = ([regex]::Match($index, 'src=\"\./(js/core/version\.v[0-9.]+\.js(?:\?[^"]*)?)\"')).Groups[1].Value
if (-not $coreRuta) {
  $coreRuta = ([regex]::Match($index, "src='\./(js/core/version\.v[0-9.]+\.js(?:\?[^']*)?)'")).Groups[1].Value
}
if (-not $appRuta -or -not $coreRuta) { throw 'No se encontraron los archivos inmutables de la publicación' }
if ($appRuta.Contains('?') -or $coreRuta.Contains('?')) {
  throw 'Los archivos inmutables de la publicación no deben contener parámetros de caché en index.html'
}

$app = Obtener-TextoPublico $appRuta
$core = Obtener-TextoPublico $coreRuta
$liviano = Obtener-TextoPublico 'js/core/version.js'
$worker = Obtener-TextoPublico 'sw.js'

if ($app -notmatch "VERSION:\s*'$([regex]::Escape($versionFirebase))'") { throw "$appRuta no coincide con $versionFirebase" }
# Toda publicación debe dejar una entrada visible en Novedades. Si falta, no
# se activa el marcador Firebase y por lo tanto la actualización no se anuncia
# como terminada a los usuarios.
if ($app -notmatch "(?s)RELEASE_HISTORY.*?version:\s*'$([regex]::Escape($Version))'") {
  throw "$appRuta no contiene la novedad obligatoria para $Version"
}
if ($core -notmatch "SISVENTAS_PWA_VERSION\s*=\s*'$([regex]::Escape($Version))'") { throw "$coreRuta no coincide con $Version" }
if ($liviano -notmatch "SISVENTAS_PWA_VERSION\s*=\s*'$([regex]::Escape($Version))'") { throw 'El marcador liviano no coincide' }
if ($worker -notmatch "sisventas-$([regex]::Escape($Version))") { throw 'El Service Worker no coincide' }

$gcloudCandidatos = @(
  (Get-Command gcloud -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1),
  'C:\Users\gon_s\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$gcloud = $gcloudCandidatos | Select-Object -First 1
if (-not $gcloud) { throw 'No se encontró Google Cloud SDK' }

$accessToken = & $gcloud auth print-access-token
if (-not $accessToken) { throw 'No se pudo obtener autorización de Google Cloud' }
$firebaseHeaders = @{ Authorization = "Bearer $accessToken" }
$firebaseUrl = 'https://nixa-sisventas-default-rtdb.firebaseio.com/sisventas/config/version.json'
$body = ConvertTo-Json $versionFirebase
Invoke-RestMethod -Method Put -Headers $firebaseHeaders -ContentType 'application/json' -Body $body $firebaseUrl | Out-Null
$confirmada = Invoke-RestMethod -Method Get -Headers $firebaseHeaders $firebaseUrl
if ($confirmada -ne $versionFirebase) { throw "Firebase respondió una versión inesperada: $confirmada" }

Write-Output "OK: web, marcador liviano, Service Worker y Firebase sincronizados en $versionFirebase"
