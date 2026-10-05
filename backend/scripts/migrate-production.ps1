$ErrorActionPreference = 'Stop'
$secureUrl = Read-Host 'Owner migration database URL (direct or session pooler)' -AsSecureString
$pointer = [IntPtr]::Zero
$previousUrl = [Environment]::GetEnvironmentVariable('MIGRATION_DATABASE_URL', 'Process')

Push-Location (Join-Path $PSScriptRoot '..')
try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
    $env:MIGRATION_DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ([string]::IsNullOrWhiteSpace($env:MIGRATION_DATABASE_URL)) {
        throw 'A migration database URL is required.'
    }
    & npm.cmd run migrate:status
    if ($LASTEXITCODE -ne 0) { throw 'Migration status failed. Do not deploy.' }
    & npm.cmd run migrate
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed. Do not deploy.' }
    & npm.cmd run migrate:status
    if ($LASTEXITCODE -ne 0) { throw 'Final migration status failed. Do not deploy.' }
} finally {
    [Environment]::SetEnvironmentVariable('MIGRATION_DATABASE_URL', $previousUrl, 'Process')
    if ($pointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    $secureUrl.Dispose()
    Pop-Location
}
