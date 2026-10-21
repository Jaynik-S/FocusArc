<#
Persistent, isolated Windows demo. Run Setup once, then Api and Web in two terminals.
All database files and downloaded tools stay in the ignored .deployment-private folder.
No Docker, Neon credentials, administrator privileges, or Windows service is needed.
#>
[CmdletBinding()]
param(
    [ValidateSet('Setup', 'Database', 'Api', 'Web', 'Stop')]
    [string]$Action = 'Setup',
    [string]$PythonPath
)

$ErrorActionPreference = 'Stop'
$repoDirectory = Split-Path -Parent $PSScriptRoot
$demoDirectory = Join-Path $repoDirectory '.deployment-private\local-demo'
$pgDirectory = Join-Path $demoDirectory 'pgsql'
$pgDataDirectory = Join-Path $demoDirectory 'pgdata'
$pgControl = Join-Path $pgDirectory 'bin\pg_ctl.exe'
$localDatabaseUrl = 'postgresql+psycopg://focusarc_demo_admin:focusarc_local_demo@127.0.0.1:55439/focusarc_demo'

function Assert-LastExit([string]$Operation) {
    if ($LASTEXITCODE -ne 0) { throw "$Operation failed (exit $LASTEXITCODE)." }
}

function Set-DemoEnvironment {
    # Always override inherited hosted credentials, including Alembic's separate URL.
    $env:APP_ENV = 'dev'
    $env:DATABASE_URL = $localDatabaseUrl
    $env:MIGRATION_DATABASE_URL = $localDatabaseUrl
    $env:CORS_ORIGINS = 'http://localhost:5173'
    $env:SESSION_SECRET = 'focusarc-local-demo-only-session-secret'
    $env:VITE_API_BASE_URL = 'http://localhost:8000/api'
    $env:UV_CACHE_DIR = Join-Path $demoDirectory 'uv-cache'
    $env:UV_PYTHON_INSTALL_DIR = Join-Path $demoDirectory 'python'
    foreach ($key in @('PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGSERVICE', 'PGSERVICEFILE', 'PGSYSCONFDIR', 'PGOPTIONS', 'PGPASSWORD')) {
        Remove-Item "Env:\$key" -ErrorAction SilentlyContinue
    }
}

function Find-DemoPython {
    if ($PythonPath) { return (Resolve-Path -LiteralPath $PythonPath).Path }
    foreach ($candidate in @(
        (Join-Path $demoDirectory 'venv\Scripts\python.exe'),
        (Join-Path $repoDirectory 'node_modules\.cache\focusarc-analytics\venv\Scripts\python.exe')
    )) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    throw 'Python environment missing. Run Setup first, or supply -PythonPath pointing to a backend virtual environment.'
}

function Start-DemoDatabase {
    if (!(Test-Path -LiteralPath (Join-Path $pgDataDirectory 'PG_VERSION'))) {
        throw 'Demo database is not initialized. Run Setup first.'
    }
    & $pgControl -D $pgDataDirectory status *> $null
    if ($LASTEXITCODE -ne 0) {
        $start = Start-Process -FilePath $pgControl -ArgumentList @(
            '-D', ('"' + $pgDataDirectory + '"'), '-l', ('"' + (Join-Path $demoDirectory 'postgres.log') + '"'), '-w', 'start'
        ) -WindowStyle Hidden -PassThru
        # Start-Process -Wait follows descendants, including the persistent server.
        # WaitForExit waits only for pg_ctl's startup/health check to finish.
        $start.WaitForExit()
        if ($start.ExitCode -ne 0) { throw 'PostgreSQL did not start. Check .deployment-private/local-demo/postgres.log (including port 55439 conflicts).' }
    }
    Write-Host 'Demo PostgreSQL: 127.0.0.1:55439 / focusarc_demo (persistent, local only)'
}

Push-Location $repoDirectory
try {
    Set-DemoEnvironment
    if ($Action -eq 'Stop') {
        if (Test-Path -LiteralPath $pgControl) {
            & $pgControl -D $pgDataDirectory -m fast -w stop
            Assert-LastExit 'Stop demo PostgreSQL'
        }
        return
    }

    if ($Action -eq 'Setup') {
        New-Item -ItemType Directory -Path $demoDirectory -Force | Out-Null
        if (!(Test-Path -LiteralPath $pgControl)) {
            $archivePath = Join-Path $demoDirectory 'postgresql.zip'
            if (!(Test-Path -LiteralPath $archivePath)) {
                Write-Host 'Downloading official EDB PostgreSQL 15.19 Windows x64 binaries (~315 MB)...'
                & curl.exe --fail --location --retry 2 --output $archivePath 'https://get.enterprisedb.com/postgresql/postgresql-15.19-1-windows-x64-binaries.zip'
                Assert-LastExit 'PostgreSQL download'
            }
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
            try {
                foreach ($entry in $archive.Entries) {
                    # Only the server/client runtime, excluding pgAdmin and documentation.
                    if ($entry.FullName -notmatch '^pgsql/(bin|lib|share)/' -or !$entry.Name) { continue }
                    $entryPath = [IO.Path]::GetFullPath((Join-Path $demoDirectory $entry.FullName))
                    if (!$entryPath.StartsWith($demoDirectory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
                        throw 'Archive contains an invalid path.'
                    }
                    New-Item -ItemType Directory -Path (Split-Path -Parent $entryPath) -Force | Out-Null
                    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $entryPath, $true)
                }
            } finally { $archive.Dispose() }
        }

        try { $pythonExecutable = Find-DemoPython } catch {
            if ($PythonPath) { throw }
            if (!(Get-Command uv -ErrorAction SilentlyContinue)) {
                throw 'Install uv (https://docs.astral.sh/uv/getting-started/installation/) or supply -PythonPath for an environment with backend dependencies installed.'
            }
            & uv venv --python cpython-3.12-windows-x86_64-none (Join-Path $demoDirectory 'venv')
            Assert-LastExit 'Create Python environment'
            $pythonExecutable = Find-DemoPython
        }
        & $pythonExecutable -m alembic --version *> $null
        if ($LASTEXITCODE -ne 0) {
            if (!(Get-Command uv -ErrorAction SilentlyContinue)) {
                throw 'Backend dependencies are missing. Install uv, or supply a prepared backend environment with -PythonPath.'
            }
            # uvloop is Linux/macOS-only; all other versions match the release lock.
            $windowsLock = Join-Path $demoDirectory 'requirements-windows.lock'
            Get-Content backend/requirements.lock | Where-Object { $_ -notmatch '^uvloop==' } | Set-Content -LiteralPath $windowsLock
            & uv pip install --python $pythonExecutable -r $windowsLock
            Assert-LastExit 'Install backend dependencies'
        }

        if (!(Test-Path -LiteralPath (Join-Path $pgDataDirectory 'PG_VERSION'))) {
            $passwordFile = Join-Path $demoDirectory 'init-password.txt'
            try {
                'focusarc_local_demo' | Set-Content -LiteralPath $passwordFile -Encoding ascii
                & (Join-Path $pgDirectory 'bin\initdb.exe') -D $pgDataDirectory -U focusarc_demo_admin --auth=scram-sha-256 --encoding=UTF8 --locale=C "--pwfile=$passwordFile"
                Assert-LastExit 'Initialize demo PostgreSQL'
            } finally { Remove-Item -LiteralPath $passwordFile -ErrorAction SilentlyContinue }
            Add-Content -LiteralPath (Join-Path $pgDataDirectory 'postgresql.conf') -Value "`nport = 55439`nlisten_addresses = '127.0.0.1'`n"
        }
        Start-DemoDatabase
        $env:PGPASSWORD = 'focusarc_local_demo'
        try {
            $databaseExists = & (Join-Path $pgDirectory 'bin\psql.exe') -h 127.0.0.1 -p 55439 -U focusarc_demo_admin -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='focusarc_demo'"
            Assert-LastExit 'Check demo database'
            if ($databaseExists -ne '1') {
                & (Join-Path $pgDirectory 'bin\createdb.exe') -h 127.0.0.1 -p 55439 -U focusarc_demo_admin focusarc_demo
                Assert-LastExit 'Create demo database'
            }
        } finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
        Push-Location backend
        try {
            & $pythonExecutable -m alembic upgrade head
            Assert-LastExit 'Apply local migrations'
            $seedMarker = Join-Path $demoDirectory 'seeded.txt'
            if (!(Test-Path -LiteralPath $seedMarker)) {
                $env:FOCUSARC_DEMO_PASSWORD = 'demo12345'
                try {
                    & $pythonExecutable -m app.demo_analytics --username demo --create-account
                    Assert-LastExit 'Create demo account and history'
                    'demo account seeded; Setup will preserve subsequent changes' | Set-Content -LiteralPath $seedMarker
                } finally { Remove-Item Env:\FOCUSARC_DEMO_PASSWORD -ErrorAction SilentlyContinue }
            } else { Write-Host 'Existing demo history preserved; nothing was reseeded.' }
        } finally { Pop-Location }
        Write-Host 'Ready. Start Api and Web in separate terminals, then open http://localhost:5173/stats'
        Write-Host 'Local demo login: demo / demo12345'
        return
    }

    if ($Action -eq 'Database') { Start-DemoDatabase; return }
    if ($Action -eq 'Api') {
        Start-DemoDatabase
        $pythonExecutable = Find-DemoPython
        Set-Location backend
        & $pythonExecutable -m uvicorn app.main:app --host 127.0.0.1 --port 8000
        Assert-LastExit 'Demo API'
    }
    if ($Action -eq 'Web') {
        Set-Location frontend
        if (!(Test-Path node_modules)) { & npm.cmd ci; Assert-LastExit 'Install frontend dependencies' }
        & npm.cmd run dev -- --host localhost --port 5173 --strictPort --configLoader runner
        Assert-LastExit 'Demo frontend'
    }
} finally { Pop-Location }
