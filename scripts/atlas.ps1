#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("dev", "test", "build-desktop")]
    [string]$Command,
    [Parameter(Mandatory = $true)]
    [ValidateSet("creator", "enterprise")]
    [string]$Product
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$env:ATLAS_PRODUCT = $Product

switch ($Command) {
    "dev" {
        $Server = Join-Path $Root ".venv\Scripts\openworker-server.exe"
        if (-not (Test-Path $Server)) { throw "Create .venv and install the project first." }
        & $Server --product $Product
    }
    "test" {
        $Python = Join-Path $Root ".venv\Scripts\python.exe"
        if (-not (Test-Path $Python)) { $Python = "python" }
        & $Python -m pytest tests/test_atlas_product.py
        if ($LASTEXITCODE -ne 0) { throw "Atlas tests failed." }
        Push-Location (Join-Path $Root "surfaces\gui")
        try {
            & npm test -- --run src/product.test.ts
            if ($LASTEXITCODE -ne 0) { throw "Atlas GUI tests failed." }
        } finally { Pop-Location }
    }
    "build-desktop" {
        & (Join-Path $Root "packaging\build_windows.ps1") -Product $Product
    }
}
