param(
    [string]$Hostname = 'chad.tailcc89e3.ts.net'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeRoot = Join-Path $projectRoot 'deploy\runtime'
$startScript = Join-Path $PSScriptRoot 'start-public.ps1'
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

while ($true) {
    try {
        & $startScript -Hostname $Hostname | Out-Null
    } catch {
        $message = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $_.Exception.Message
        Add-Content -LiteralPath (Join-Path $runtimeRoot 'public-watch.err.log') -Value $message
    }
    Start-Sleep -Seconds 60
}
