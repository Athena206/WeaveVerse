$ErrorActionPreference = "Stop"

$serverRoot = Join-Path $PSScriptRoot "mysql-portable\PFiles64\MySQL\MySQL Server 8.4"
$server = Join-Path $serverRoot "bin\mysqld.exe"
$dataDirectory = Join-Path $PSScriptRoot "mysql-data"
$logFile = Join-Path $PSScriptRoot "mysql-server.log"
$errorFile = Join-Path $PSScriptRoot "mysql-server.err.log"

if (-not (Test-Path $server)) {
    throw "The local MySQL server is not installed. Follow the MySQL setup in README.md."
}

$listener = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    throw "Port 3306 is already in use. Stop that MySQL server before starting this project database."
}

New-Item -ItemType Directory -Force -Path $dataDirectory | Out-Null
if (-not (Test-Path (Join-Path $dataDirectory "auto.cnf"))) {
    & $server --no-defaults "--basedir=$serverRoot" "--datadir=$dataDirectory" --initialize-insecure --console
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL data initialization failed with exit code $LASTEXITCODE."
    }
}

$arguments = @(
    "--no-defaults",
    "--basedir=$serverRoot",
    "--datadir=$dataDirectory",
    "--bind-address=127.0.0.1",
    "--port=3306",
    "--mysqlx=0",
    "--console"
)
$process = Start-Process -FilePath $server -ArgumentList $arguments `
    -WorkingDirectory $serverRoot -RedirectStandardOutput $logFile `
    -RedirectStandardError $errorFile -PassThru

for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    if ($process.HasExited) {
        $details = Get-Content $errorFile -ErrorAction SilentlyContinue | Select-Object -Last 25
        throw "MySQL exited during startup. $($details -join ' ')"
    }
    $connection = [System.Net.Sockets.TcpClient]::new()
    try {
        $connection.Connect("127.0.0.1", 3306)
        $connection.Close()
        Write-Output "Project MySQL is ready at 127.0.0.1:3306 (process $($process.Id))."
        exit 0
    } catch {
        $connection.Dispose()
    }
}

Stop-Process -Id $process.Id
throw "MySQL did not accept connections on port 3306 within 30 seconds."
