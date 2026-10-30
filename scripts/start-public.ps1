param(
    [string]$Hostname = 'chad.tailcc89e3.ts.net'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendRoot = Join-Path $projectRoot 'backend'
$runtimeRoot = Join-Path $projectRoot 'deploy\runtime'
$pythonExe = Join-Path $backendRoot 'venv\Scripts\python.exe'
$waitressExe = Join-Path $backendRoot 'venv\Scripts\waitress-serve.exe'
$nodeExe = 'C:\Program Files\nodejs\node.exe'
$frontendScript = Join-Path $projectRoot 'frontend\scripts\serve-public.cjs'
$frontendBuild = Join-Path $projectRoot 'frontend\build\index.html'

if (-not (Test-Path -LiteralPath $frontendBuild)) {
    throw 'Frontend build missing. Run npm.cmd run build inside frontend first.'
}
if (-not (Test-Path -LiteralPath $pythonExe) -or -not (Test-Path -LiteralPath $waitressExe)) {
    throw 'Backend virtual environment or Waitress is missing.'
}
if (-not (Test-Path -LiteralPath $nodeExe)) {
    throw 'Node.js is missing.'
}

$debugLine = Get-Content (Join-Path $backendRoot '.env') | Where-Object { $_ -match '^DJANGO_DEBUG=' } | Select-Object -Last 1
if ($debugLine -ne 'DJANGO_DEBUG=False') {
    throw 'Set DJANGO_DEBUG=False before starting the public server.'
}

function Test-LocalPort([int]$port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $client.Connect('127.0.0.1', $port)
        return $true
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$backendProcess = $null
$frontendProcess = $null
if (-not (Test-LocalPort 8100)) {
    & $pythonExe (Join-Path $backendRoot 'manage.py') check --deploy
    if ($LASTEXITCODE -ne 0) { throw 'Django production check failed.' }
    $backendProcess = Start-Process -FilePath $waitressExe `
        -ArgumentList '--listen=127.0.0.1:8100','--trusted-proxy=127.0.0.1','config.wsgi:application' `
        -WorkingDirectory $backendRoot `
        -RedirectStandardOutput (Join-Path $runtimeRoot 'backend-public.out.log') `
        -RedirectStandardError (Join-Path $runtimeRoot 'backend-public.err.log') `
        -WindowStyle Hidden -PassThru
}
if (-not (Test-LocalPort 3100)) {
    $frontendProcess = Start-Process -FilePath $nodeExe `
        -ArgumentList $frontendScript `
        -WorkingDirectory $projectRoot `
        -RedirectStandardOutput (Join-Path $runtimeRoot 'frontend-public.out.log') `
        -RedirectStandardError (Join-Path $runtimeRoot 'frontend-public.err.log') `
        -WindowStyle Hidden -PassThru
}

$expectedStatus = 200
$redirectTarget = $null
$migrationStatePath = Join-Path $backendRoot '.cloud-migration.json'
if (Test-Path -LiteralPath $migrationStatePath) {
    $expectedStatus = 503
    try {
        $migrationState = Get-Content -LiteralPath $migrationStatePath -Raw | ConvertFrom-Json
        if ($migrationState.mode -eq 'redirect') {
            $expectedStatus = 302
            $redirectTarget = $migrationState.target.TrimEnd('/')
        }
    } catch {
        # A damaged marker intentionally keeps the old application unavailable.
    }
}

function Get-LocalHealthResponse([string]$path) {
    $request = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:3100$path")
    $request.Host = $Hostname
    $request.AllowAutoRedirect = $false
    $request.Timeout = 10000
    $response = $null
    try {
        try { $response = $request.GetResponse() }
        catch [System.Net.WebException] {
            if (-not $_.Exception.Response) { throw }
            $response = $_.Exception.Response
        }
        return @{ Status = [int]$response.StatusCode; Location = $response.Headers['Location'] }
    } finally {
        if ($response) { $response.Close() }
    }
}
try {
    $deadline = (Get-Date).AddSeconds(30)
    while ($true) {
        try {
            foreach ($healthPath in @('/', '/api/csrf/')) {
                $response = Get-LocalHealthResponse $healthPath
                if ($response.Status -ne $expectedStatus) { throw 'Local health checks returned an unexpected status.' }
                if ($expectedStatus -eq 302 -and $response.Location -ne "$redirectTarget$healthPath") { throw 'Local cloud redirect target did not match.' }
            }
            break
        } catch {
            if ((Get-Date) -ge $deadline) { throw }
            Start-Sleep -Milliseconds 500
        }
    }
    if ($expectedStatus -eq 302) {
        Write-Output "Legacy public server redirects to $redirectTarget."
    } elseif ($expectedStatus -eq 503) {
        Write-Output 'Legacy public server is intentionally paused for migration.'
    } else {
        Write-Output "Local public server ready for https://$Hostname."
    }
} catch {
    @($backendProcess, $frontendProcess) | Where-Object { $_ } | Stop-Process -ErrorAction SilentlyContinue
    throw "Local public server health check failed. Check deploy/runtime logs. $($_.Exception.Message)"
}
