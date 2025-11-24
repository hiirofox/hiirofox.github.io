@echo off
REM ==========================================
REM Enola Online DSP Build System
REM Manual Emscripten Path Configuration
REM ==========================================

REM Set Emscripten Path manually
set "EM_PATH=D:\Program Files\emsdk\emsdk\upstream\emscripten"
set "PATH=%EM_PATH%;%PATH%"

REM Check for emcc
where emcc >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Cannot find emcc command!
    echo Please check the path: "%EM_PATH%"
    pause
    exit /b
)

echo [INFO] Emscripten found.
mkdir ..\wasm 2>nul

echo [BUILD] Starting Compilation...

REM Compilation Flags
REM -s STANDALONE_WASM=1: 生成标准 WASM，不依赖胶水代码，自动处理内存和符号
REM -s EXPORTED_FUNCTIONS: 明确导出函数
REM --no-entry: 无 main 函数
set FLAGS=-O3 --no-entry -s STANDALONE_WASM=1 -s ERROR_ON_UNDEFINED_SYMBOLS=0 -s WARN_ON_UNDEFINED_SYMBOLS=0

REM --- 1. Oscillator ---
echo [Compiling] Oscillator...
call emcc cpp/oscillator.cpp -o ../wasm/oscillator.wasm %FLAGS% -s EXPORTED_FUNCTIONS="['_create_state','_process','_set_type','_malloc','_free']"

REM --- 2. LFO ---
echo [Compiling] LFO...
call emcc cpp/lfo.cpp -o ../wasm/lfo.wasm %FLAGS% -s EXPORTED_FUNCTIONS="['_create_state','_process','_set_type','_malloc','_free']"

REM --- 3. Gain ---
echo [Compiling] Gain...
call emcc cpp/gain.cpp -o ../wasm/gain.wasm %FLAGS% -s EXPORTED_FUNCTIONS="['_process','_malloc','_free']"

REM --- 4. Envelope ---
echo [Compiling] Envelope...
call emcc cpp/envelope.cpp -o ../wasm/envelope.wasm %FLAGS% -s EXPORTED_FUNCTIONS="['_create_state','_process','_malloc','_free']"

REM --- 5. Clock ---
echo [Compiling] Clock...
call emcc cpp/clock.cpp -o ../wasm/clock.wasm %FLAGS% -s EXPORTED_FUNCTIONS="['_create_state','_process','_malloc','_free']"

REM --- 6. Sequencer ---
echo [Compiling] Sequencer...
call emcc cpp/sequencer.cpp -o ../wasm/sequencer.wasm %FLAGS% -s EXPORTED_FUNCTIONS="['_create_state','_process','_malloc','_free']"

REM --- 7. Mixer ---
echo [Compiling] Mixer...
call emcc cpp/mixer.cpp -o ../wasm/mixer.wasm %FLAGS% -s EXPORTED_FUNCTIONS="['_process','_malloc','_free']"

echo [BUILD] Done! Check ../wasm/ folder.
pause