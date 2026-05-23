let Module = null;
let audio = null;
let state = null;
let capacity = 0;
let ready = false;
let running = false;
let pumpTimer = null;

const blockFrames = 128;
const targetQueuedFrames = 1024;

function locateFile(path) {
  return `dist/${path}`;
}

function writableFrames() {
  const read = Atomics.load(state, 0);
  const write = Atomics.load(state, 1);
  return read <= write ? capacity - (write - read) - 1 : read - write - 1;
}

function queuedFrames() {
  const read = Atomics.load(state, 0);
  const write = Atomics.load(state, 1);
  return write >= read ? write - read : capacity - read + write;
}

function writeRenderedBlock(frames) {
  Module._dirtynth_render(frames);

  let write = Atomics.load(state, 1);

  for (let i = 0; i < frames; i += 1) {
    const offset = write * 2;
    audio[offset] = Module._dirtynth_read_left(i);
    audio[offset + 1] = Module._dirtynth_read_right(i);
    write = (write + 1) % capacity;
  }

  Atomics.store(state, 1, write);
}

function pumpOnce() {
  if (!running || !ready) {
    return;
  }

  try {
    let guard = 0;
    let queued = queuedFrames();
    let writable = writableFrames();
    while (queued + blockFrames <= targetQueuedFrames && writable >= blockFrames && guard < 16) {
      writeRenderedBlock(blockFrames);
      guard += 1;
      queued = queuedFrames();
      writable = writableFrames();
    }
  } catch (error) {
    running = false;
    postMessage({ type: "error", message: error && error.message ? `pump: ${error.message}` : `pump: ${String(error)}` });
  }
}

async function init(data) {
  capacity = data.capacity;
  audio = new Float32Array(data.audioBuffer);
  state = new Int32Array(data.stateBuffer);

  importScripts("dist/dirtynth.js");
  Module = await createDirtynthModule({
    locateFile,
    mainScriptUrlOrBlob: "dist/dirtynth.js",
    printErr: (message) => postMessage({ type: "error", message: `wasm: ${message}` })
  });
  Module._dirtynth_init(data.sampleRate);

  ready = true;
  running = true;
  postMessage({ type: "ready" });
  pumpTimer = setInterval(pumpOnce, 4);
  pumpOnce();
}

onmessage = (event) => {
  const data = event.data;

  if (data.type === "init") {
    init(data).catch((error) => {
      postMessage({ type: "error", message: error && error.message ? error.message : String(error) });
    });
    return;
  }

  if (!ready) {
    return;
  }

  if (data.type === "param") {
    Module._dirtynth_set_parameter(data.id, data.value);
  } else if (data.type === "noteOn") {
    Module._dirtynth_note_on(data.note, data.velocity);
  } else if (data.type === "noteOff") {
    Module._dirtynth_note_off(data.note);
  } else if (data.type === "allNotesOff") {
    Module._dirtynth_all_notes_off();
  }
};

onerror = (message, source, lineno, colno, error) => {
  postMessage({ type: "error", message: error && error.message ? error.message : String(message) });
};

onmessageerror = () => {
  postMessage({ type: "error", message: "DSP worker message error" });
};
