[CmdletBinding()]
param(
  [string]$EnvFile = ".env.functions.production",
  [string]$CredentialCsv,
  [string]$AppOrigins = "https://usmoments.in,https://www.usmoments.in",
  [string]$ProjectRef = "krdwlkdwwawoucigilxw"
)

$ErrorActionPreference = "Stop"

function Get-EnvValues {
  param([Parameter(Mandatory)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Environment file not found: $Path"
  }

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      $value = $matches[2]
      if (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      ) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      $values[$matches[1]] = $value
    }
  }

  return $values
}

if ($CredentialCsv) {
  if (-not (Test-Path -LiteralPath $CredentialCsv -PathType Leaf)) {
    throw "Razorpay credential CSV not found: $CredentialCsv"
  }

  $credentialRows = @(Import-Csv -LiteralPath $CredentialCsv)
  if ($credentialRows.Count -ne 1) {
    throw "Razorpay credential CSV must contain exactly one data row."
  }

  $keyId = [string]$credentialRows[0].key_id
  $keySecret = [string]$credentialRows[0].key_secret
  $appOrigins = $AppOrigins
}
else {
  $envValues = Get-EnvValues -Path $EnvFile
  $keyId = $envValues["RAZORPAY_KEY_ID"]
  $keySecret = $envValues["RAZORPAY_KEY_SECRET"]
  $appOrigins = $envValues["APP_ORIGINS"]
}

if ($keyId -notmatch '^rzp_(test|live)_[A-Za-z0-9]{10,}$') {
  throw "RAZORPAY_KEY_ID is missing or does not look like a Razorpay key ID."
}

if ($keySecret -notmatch '^[A-Za-z0-9]{16,}$') {
  throw "RAZORPAY_KEY_SECRET is missing or does not look like a Razorpay key secret."
}

if ([string]::IsNullOrWhiteSpace($appOrigins)) {
  throw "APP_ORIGINS is missing."
}

$origins = @($appOrigins.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$invalidOrigins = @($origins | Where-Object { $_ -notmatch '^https://[^/]+$' })
if ($origins.Count -eq 0 -or $invalidOrigins.Count -gt 0) {
  throw "APP_ORIGINS must be a comma-separated list of HTTPS origins without paths."
}

$temporaryEnvFile = Join-Path ([System.IO.Path]::GetTempPath()) "usmoments-billing-$([guid]::NewGuid().ToString('N')).env"

try {
  $lines = @(
    "RAZORPAY_KEY_ID=$keyId"
    "RAZORPAY_KEY_SECRET=$keySecret"
    "APP_ORIGINS=$($origins -join ',')"
  )
  [System.IO.File]::WriteAllLines(
    $temporaryEnvFile,
    $lines,
    [System.Text.UTF8Encoding]::new($false)
  )

  Write-Host "Uploading billing secrets to Supabase project $ProjectRef..."
  & npx.cmd --yes supabase@2.114.0 secrets set `
    --env-file $temporaryEnvFile `
    --project-ref $ProjectRef

  if ($LASTEXITCODE -ne 0) {
    throw "Supabase CLI exited with code $LASTEXITCODE."
  }

  Write-Host "Billing secrets uploaded successfully."
}
finally {
  if (Test-Path -LiteralPath $temporaryEnvFile) {
    Remove-Item -LiteralPath $temporaryEnvFile -Force
  }
}
