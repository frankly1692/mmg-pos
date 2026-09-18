# Builds mmg-helper.exe (PyInstaller) and wraps it in MMG-Helper-Setup.exe (Inno Setup 6).
# Requires: .venv with requirements + pyinstaller, and Inno Setup 6 (https://jrsoftware.org/isdl.php).
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Push-Location "$root\helper"
try {
    & "$root\.venv\Scripts\pyinstaller.exe" --noconfirm mmg-helper.spec
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }
} finally { Pop-Location }

$iscc = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw "Inno Setup 6 not found. Install it from https://jrsoftware.org/isdl.php" }

& $iscc "$root\installer\mmg-helper.iss"
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed" }
Write-Host "Built: $root\installer\Output\MMG-Helper-Setup.exe" -ForegroundColor Green
