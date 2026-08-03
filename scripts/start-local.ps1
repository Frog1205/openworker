$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\")).Path
$gui = Join-Path $root "surfaces\gui"
$self = $PID

# Stop only this project's worker/Vite tree; never use a broad name-only kill.
$stale = Get-CimInstance Win32_Process | Where-Object {
  $_.ProcessId -ne $self -and (
    $_.Name -eq "openworker-server.exe" -or
    $_.CommandLine -like "*$root*" -or
    $_.CommandLine -like "*vite/bin/vite.js*1420*"
  )
}
foreach ($process in @($stale)) {
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

# The Vite bundle reads the launch token at startup, so the worker must start first.
Start-Process -FilePath (Join-Path $root ".venv\Scripts\openworker-server.exe") `
  -ArgumentList "--cwd", $root, "--port", "8765", "--product", "creator" -WindowStyle Hidden
$token = Join-Path $env:APPDATA "com.atlas.creator\sidecar-8765.token"
if (Test-Path $token) { Remove-Item -LiteralPath $token -Force }
$deadline = (Get-Date).AddSeconds(30)
while (-not (Test-Path $token) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
if (-not (Test-Path $token)) { throw "Atlas Worker did not publish its launch token." }

Start-Process -FilePath "D:\Environment\nodejs\node.exe" `
  -ArgumentList "node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "1420" `
  -WorkingDirectory $gui -WindowStyle Hidden
Write-Output "Atlas Creator started: http://127.0.0.1:1420/"
