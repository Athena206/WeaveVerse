$ErrorActionPreference = "Stop"

$downloadDirectory = Join-Path $PSScriptRoot "mysql-installer-inspect"
$installDirectory = Join-Path $PSScriptRoot "mysql-portable"
New-Item -ItemType Directory -Force -Path $downloadDirectory | Out-Null

if (Test-Path (Join-Path $installDirectory "PFiles64\MySQL\MySQL Server 8.4\bin\mysqld.exe")) {
    Write-Output "Project-local MySQL is already installed."
    exit 0
}

winget download --id Oracle.MySQL --exact --version 8.4.9 `
    --accept-package-agreements --accept-source-agreements `
    --download-directory $downloadDirectory
if ($LASTEXITCODE -ne 0) {
    throw "Downloading MySQL failed with exit code $LASTEXITCODE."
}

$installer = Get-ChildItem $downloadDirectory -Filter "*.msi" -Recurse |
    Where-Object { $_.Name -like "MySQL_8.4.9_*" } |
    Select-Object -First 1
if (-not $installer) {
    throw "The MySQL server installer was not found in $downloadDirectory."
}

$arguments = @(
    "/a",
    "`"$($installer.FullName)`"",
    "/qn",
    "TARGETDIR=`"$installDirectory`""
)
$process = Start-Process -FilePath "msiexec.exe" -ArgumentList $arguments -Wait -PassThru
if ($process.ExitCode -ne 0) {
    throw "Extracting MySQL failed with exit code $($process.ExitCode)."
}

$server = Join-Path $installDirectory "PFiles64\MySQL\MySQL Server 8.4\bin\mysqld.exe"
if (-not (Test-Path $server)) {
    throw "MySQL extraction finished, but mysqld.exe was not found."
}
Write-Output "MySQL 8.4.9 is ready in the project; no Windows service or admin install was used."
