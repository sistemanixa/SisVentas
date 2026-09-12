param([Parameter(Mandatory=$true)][ValidatePattern('^v?\d+\.\d+\.\d+$')][string]$Version)
$partes = $Version.TrimStart('v').Split('.')
$mayor = [int]$partes[0]
$menor = [int]$partes[1]
$parche = [int]$partes[2]
if ($parche -ge 20) { $menor++; $parche = 0 } else { $parche++ }
Write-Output "v$mayor.$menor.$parche"
