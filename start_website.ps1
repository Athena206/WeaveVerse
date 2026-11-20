$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot
$python = Join-Path $PSScriptRoot "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    $python = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
}
if (-not (Test-Path $python)) {
    throw "Python virtual environment not found. Create backend\.venv and install backend\requirements.txt."
}

& $python (Join-Path $PSScriptRoot "backend\app.py")
