param([string]$JavaRuntime = 'C:\Program Files\Android\Android Studio\jbr')
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path $PSScriptRoot -Parent
$cli = Join-Path $projectDirectory 'tmp/firebase-security-tools/node_modules/firebase-tools/lib/bin/firebase.js'
if (!(Test-Path -LiteralPath $cli)) { throw 'Instalar las herramientas de emulador indicadas en security/README.md.' }
if (!(Test-Path -LiteralPath (Join-Path $JavaRuntime 'bin/java.exe'))) { throw 'Indicar un runtime Java válido mediante -JavaRuntime.' }
$previousJava = $env:JAVA_HOME
$previousPath = $env:PATH
$previousCI = $env:CI
$previousBaseline = $env:SV_RULES_BASELINE
Push-Location $projectDirectory
try {
  $env:JAVA_HOME = $JavaRuntime
  $env:PATH = "$JavaRuntime\bin;$env:PATH"
  $env:CI = 'true'
  $env:SV_RULES_BASELINE = ''
  node $cli emulators:exec --only database --project demo-sisventas-security --config security/firebase.emulator.json 'node --test --test-concurrency=1 test/firebase-identidad.integration.cjs test/firebase-control-acceso.integration.cjs test/control-access-migration.test.js test/security-storage.test.js test/security-auth-order.test.js test/usuario-estado-acceso.test.js'
  if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas de identidad Firebase.' }
} finally {
  Pop-Location
  $env:JAVA_HOME = $previousJava
  $env:PATH = $previousPath
  $env:CI = $previousCI
  $env:SV_RULES_BASELINE = $previousBaseline
}
