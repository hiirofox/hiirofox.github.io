param(
    [string]$EmPath = $env:EM_PATH,
    [string]$EmsdkRoot = "D:\Program Files\emsdk\emsdk"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($EmPath)) {
    $EmPath = Join-Path $EmsdkRoot "upstream\emscripten"
}

$empp = Join-Path $EmPath "em++.bat"
$python = Join-Path $EmsdkRoot "python\3.13.3_64bit\python.exe"
$node = Join-Path $EmsdkRoot "node\22.16.0_64bit\bin"

if (-not (Test-Path -LiteralPath $empp)) {
    throw "em++.bat not found at $empp"
}

if (-not (Test-Path -LiteralPath $python)) {
    throw "Bundled emsdk python.exe not found at $python"
}

$env:EMSDK = $EmsdkRoot
$env:EMSDK_PYTHON = $python
$env:PATH = "$EmsdkRoot;$EmPath;$node;$env:PATH"

$outDir = Join-Path $PSScriptRoot "dist"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$arguments = @(
    "$PSScriptRoot\wasm_bridge.cpp",
    "$PSScriptRoot\dsp\TableBlep.cpp",
    "-I$PSScriptRoot",
    "-std=c++20",
    "-O3",
    "-pthread",
    "--no-entry",
    "-sUSE_PTHREADS=1",
    "-sPTHREAD_POOL_SIZE=4",
    "-sINITIAL_MEMORY=134217728",
    "-sMODULARIZE=1",
    "-sEXPORT_NAME=createDirtynthModule",
    "-sENVIRONMENT=worker",
    "-sEXPORTED_FUNCTIONS=['_dirtynth_init','_dirtynth_set_parameter','_dirtynth_note_on','_dirtynth_note_off','_dirtynth_all_notes_off','_dirtynth_render','_dirtynth_left_buffer','_dirtynth_right_buffer','_dirtynth_read_left','_dirtynth_read_right']",
    "-o",
    "$outDir\dirtynth.js"
)

Write-Host "Running em++ for Dirtynth WebTest wasm..."
& $empp @arguments

Write-Host "Built WebTest\dist\dirtynth.js"
