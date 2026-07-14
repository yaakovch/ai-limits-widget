param([string]$DistDir = (Join-Path $PSScriptRoot '..\dist'))

$package = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\package.json') -Raw | ConvertFrom-Json
$executables = Get-ChildItem -LiteralPath $DistDir -File -Filter "Agent-Fleet-$($package.version)-*.exe"
if ($executables.Count -ne 2) { throw "Expected current signed Setup and Portable executables for $($package.version)." }

foreach ($file in $executables) {
  $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
  if ($signature.Status -ne 'Valid') {
    throw "$($file.Name) does not have a valid Authenticode signature: $($signature.Status)"
  }
  Write-Output "$($file.Name): $($signature.SignerCertificate.Subject)"
}
