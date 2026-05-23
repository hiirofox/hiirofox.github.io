const statusText = document.getElementById("status");
const startButton = document.getElementById("startButton");
const downloadPresetButton = document.getElementById("downloadPresetButton");
const controlsRoot = document.getElementById("controls");
const heldNotesRoot = document.getElementById("heldNotes");

const choices = {
  mutant: ["Sync", "Self PM", "Kickizer", "Disperser"],
  filter: ["SVF 12", "SVF 24", "Elliptic 6", "Comb", "Comb 4", "Phaser"],
  grain: ["1", "2", "4", "8", "16", "32", "64"],
  envelopeMode: ["Poly Reset", "Poly Free", "Global Free", "Global First", "Global Any"],
  target: [
    "Off", "Osc1 WT", "Osc2 WT", "Osc1 Pitch", "Osc2 Pitch", "Osc1 Detune", "Osc2 Detune",
    "PM Depth", "Osc Mix", "Osc Amp", "O1 A1", "O1 A2", "O1 A3", "O1 B1", "O1 B2", "O1 B3",
    "O2 A1", "O2 A2", "O2 A3", "O2 B1", "O2 B2", "O2 B3", "F1 Cutoff", "F2 Cutoff",
    "F1 Key", "F2 Key", "F1 Reso", "F2 Reso", "F1 Morph", "F2 Morph", "F2 Input", "Filter Mix"
  ]
};

let nextParamId = 0;
const params = [];
const octaveMin = -4;
const octaveMax = 4;

function addParam(id, name, min, max, value, options = {}) {
  params.push({ id: nextParamId, key: id, name, type: "knob", min, max, value, ...options });
  nextParamId += 1;
}

function addChoice(id, name, items, value) {
  params.push({ id: nextParamId, key: id, name, type: "choice", choices: items, value });
  nextParamId += 1;
}

function addOsc(prefix, title, oscIndex) {
  addParam(`${prefix}WtPos`, `${title} WT`, 0, 1, oscIndex === 1 ? 0.35 : 0.60);
  addParam(`${prefix}Pitch`, `${title} Pitch`, -36, 36, oscIndex === 1 ? 0 : 12);
  addParam(`${prefix}Detune`, `${title} Detune`, -100, 100, oscIndex === 1 ? -4 : 5);
  addChoice(`${prefix}MutAType`, `${title} A`, choices.mutant, oscIndex === 1 ? 0 : 1);
  addParam(`${prefix}MutA1`, `${title} A1`, 0, 1, oscIndex === 1 ? 0.15 : 0.08);
  addParam(`${prefix}MutA2`, `${title} A2`, 0, 1, oscIndex === 1 ? 0.0 : 0.30);
  addParam(`${prefix}MutA3`, `${title} A3`, 0, 1, oscIndex === 1 ? 0.25 : 0.35);
  addChoice(`${prefix}MutBType`, `${title} B`, choices.mutant, oscIndex === 1 ? 3 : 2);
  addParam(`${prefix}MutB1`, `${title} B1`, 0, 1, oscIndex === 1 ? 0.15 : 0.12);
  addParam(`${prefix}MutB2`, `${title} B2`, 0, 1, oscIndex === 1 ? 0.15 : 0.50);
  addParam(`${prefix}MutB3`, `${title} B3`, 0, 1, oscIndex === 1 ? 0.20 : 0.35);
}

function addEnvelope(index) {
  const prefix = `env${index}`;
  const title = `E${index}`;
  addChoice(`${prefix}Mode`, `${title} Mode`, choices.envelopeMode, 0);
  addChoice(`${prefix}Target`, `${title} Target`, choices.target, index === 1 ? 0 : 20 + index);
  addParam(`${prefix}Amount`, `${title} Amount`, -1, 1, index === 1 ? 0 : 0.18);
  addParam(`${prefix}Attack`, `${title} Attack`, 0.1, 5000, index === 1 ? 5 : 20, { scale: "log" });
  addParam(`${prefix}AttackShape`, `${title} A Shape`, -6, 6, -1);
  addParam(`${prefix}Decay`, `${title} Decay`, 1, 8000, index === 1 ? 100 : 240, { scale: "log" });
  addParam(`${prefix}DecayShape`, `${title} D Shape`, -6, 6, -2);
  addParam(`${prefix}Sustain`, `${title} Sustain`, 0, 1, index === 1 ? 0.75 : 0.25);
  addParam(`${prefix}Release`, `${title} Release`, 1, 8000, index === 1 ? 140 : 180, { scale: "log" });
}

addParam("master", "Master", 0, 1, 0.7);
addChoice("grain", "Env Grain", choices.grain, 4);
addOsc("osc1", "OSC 1", 1);
addOsc("osc2", "OSC 2", 2);
addParam("pmDepth", "PM Depth", 0, 0.45, 0.025);
addParam("oscMix", "Osc Mix", 0, 1, 0.45);
addParam("oscAmp", "Osc Amp", 0, 1, 0.85);
addChoice("filt1Type", "Filter 1", choices.filter, 1);
addParam("filt1Cutoff", "F1 Cutoff", 20, 20000, 2200, { scale: "log" });
addParam("filt1KeyTrack", "F1 Key", 0, 1, 0.15);
addParam("filt1Reso", "F1 Reso", 0.707, 24, 1.2, { scale: "log" });
addParam("filt1Morph", "F1 Morph", 0, 1, 0.15);
addChoice("filt2Type", "Filter 2", choices.filter, 5);
addParam("filt2Cutoff", "F2 Cutoff", 20, 20000, 900, { scale: "log" });
addParam("filt2KeyTrack", "F2 Key", 0, 1, 0.25);
addParam("filt2Reso", "F2 Reso", 0.707, 24, 1.6, { scale: "log" });
addParam("filt2Morph", "F2 Morph", 0, 1, 0.50);
addParam("filt2SwitchIn", "F2 Input", 0, 1, 0.55);
addParam("filtMix", "Filter Mix", 0, 1, 0.35);

for (let i = 1; i <= 6; i += 1) {
  addEnvelope(i);
}

const sections = [
  { title: "Global", keys: ["master", "grain", "pmDepth", "oscMix", "oscAmp", "__octave", "__preset"] },
  { title: "OSC 1", keys: ["osc1WtPos", "osc1Pitch", "osc1Detune", "osc1MutAType", "osc1MutA1", "osc1MutA2", "osc1MutA3", "osc1MutBType", "osc1MutB1", "osc1MutB2", "osc1MutB3"] },
  { title: "OSC 2", keys: ["osc2WtPos", "osc2Pitch", "osc2Detune", "osc2MutAType", "osc2MutA1", "osc2MutA2", "osc2MutA3", "osc2MutBType", "osc2MutB1", "osc2MutB2", "osc2MutB3"] },
  { title: "Filters", keys: ["filt1Type", "filt1Cutoff", "filt1KeyTrack", "filt1Reso", "filt1Morph", "filt2Type", "filt2Cutoff", "filt2KeyTrack", "filt2Reso", "filt2Morph", "filt2SwitchIn", "filtMix"] }
];

const paramByKey = new Map(params.map((param) => [param.key, param]));
const paramViews = new Map();
let octaveView = null;
let presetDefinitions = [];
let presetValues = {};
let selectedPresetId = "preset0";
let audioContext = null;
let audioNode = null;
let dspWorker = null;
let statusBase = "Loading presets...";
let octaveOffset = 0;
const activeKeys = new Map();
const activeNotes = new Set();

function setStatus(text) {
  statusBase = text;
  statusText.textContent = text;
}

function normalize(param, value) {
  if (param.scale === "log") {
    const min = Math.log(param.min);
    const max = Math.log(param.max);
    return (Math.log(value) - min) / (max - min);
  }
  return (value - param.min) / (param.max - param.min);
}

function denormalize(param, norm) {
  const clamped = Math.min(1, Math.max(0, norm));
  if (param.scale === "log") {
    return Math.exp(Math.log(param.min) + (Math.log(param.max) - Math.log(param.min)) * clamped);
  }
  return param.min + (param.max - param.min) * clamped;
}

function formatValue(param, value) {
  if (param.max >= 1000) {
    return value >= 1000 ? `${(value / 1000).toFixed(2)}k` : value.toFixed(1);
  }
  if (param.max - param.min > 20) {
    return value.toFixed(1);
  }
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function sendParam(param) {
  if (dspWorker) {
    dspWorker.postMessage({ type: "param", id: param.id, value: param.value });
  }
}

function refreshParamControl(param) {
  const view = paramViews.get(param.key);
  if (!view) {
    return;
  }

  if (view.type === "choice") {
    view.select.value = String(param.value);
  } else {
    updateKnob(view.knob, view.readout, param);
  }
}

function setParamValue(key, value, shouldSend = true) {
  if (key === "octave") {
    setOctaveOffset(value);
    return;
  }

  const param = paramByKey.get(key);
  if (!param) {
    return;
  }

  param.value = value;
  refreshParamControl(param);
  if (shouldSend) {
    sendParam(param);
  }
}

function getCurrentPresetValues() {
  return {
    octave: octaveOffset,
    ...Object.fromEntries(params.map((param) => [param.key, param.value]))
  };
}

function coercePresetValue(key, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return undefined;
  }

  if (key === "octave") {
    return Math.min(octaveMax, Math.max(octaveMin, Math.round(number)));
  }

  const param = paramByKey.get(key);
  if (!param) {
    return undefined;
  }

  if (param.type === "choice") {
    return Math.min(param.choices.length - 1, Math.max(0, Math.round(number)));
  }

  return Math.min(param.max, Math.max(param.min, number));
}

function presetNameFromFile(file) {
  return file
    .replace(/\.txt$/i, "")
    .replace(/^preset[_-]?/i, "Preset ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePresetFile(file, text) {
  const parsed = JSON.parse(text);
  const rawValues = parsed.values && typeof parsed.values === "object" ? parsed.values : parsed;
  const values = {};

  Object.entries(rawValues).forEach(([key, value]) => {
    const coerced = coercePresetValue(key, value);
    if (coerced !== undefined) {
      values[key] = coerced;
    }
  });

  if (Object.keys(values).length === 0) {
    throw new Error(`${file} has no usable parameter values`);
  }

  return {
    id: parsed.id || file.replace(/\.txt$/i, ""),
    name: parsed.name || presetNameFromFile(file),
    file,
    values
  };
}

async function loadPresetDefinitions() {
  const response = await fetch("presets.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`preset list ${response.status}`);
  }

  const listing = await response.json();
  const files = Array.isArray(listing.files) ? listing.files : [];
  if (files.length === 0) {
    throw new Error("preset list is empty");
  }

  const loaded = [];
  for (const file of files) {
    const presetResponse = await fetch(`presets/${encodeURIComponent(file)}`, { cache: "no-store" });
    if (!presetResponse.ok) {
      throw new Error(`${file} ${presetResponse.status}`);
    }
    loaded.push(parsePresetFile(file, await presetResponse.text()));
  }

  if (loaded.length === 0) {
    throw new Error("no preset files loaded");
  }

  presetDefinitions = loaded;
  presetValues = Object.fromEntries(presetDefinitions.map((preset) => [preset.id, preset.values]));
  selectedPresetId = presetValues[selectedPresetId] ? selectedPresetId : presetDefinitions[0].id;
}

function sanitizeFilenamePart(text) {
  return text
    .replace(/^Preset\s+/i, "preset_")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function downloadCurrentPreset() {
  const preset = presetDefinitions.find((item) => item.id === selectedPresetId);
  const baseName = sanitizeFilenamePart(preset ? preset.name : "preset_custom") || "preset_custom";
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "_");
  const presetDocument = {
    name: preset ? `${preset.name} Edited` : "Preset Edited",
    values: getCurrentPresetValues()
  };
  const blob = new Blob([`${JSON.stringify(presetDocument, null, 2)}\n`], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${baseName}_${timestamp}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function updateKnob(knob, readout, param) {
  const norm = normalize(param, param.value);
  knob.style.setProperty("--angle", `${-135 + norm * 270}deg`);
  knob.style.setProperty("--arc", `${norm * 270}deg`);
  readout.textContent = formatValue(param, param.value);
}

function createKnob(param) {
  const control = document.createElement("div");
  control.className = "control";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = param.name;

  const knob = document.createElement("div");
  knob.className = "knob";
  knob.tabIndex = 0;

  const readout = document.createElement("div");
  readout.className = "readout";

  let startY = 0;
  let startNorm = 0;

  function setNorm(norm) {
    param.value = denormalize(param, norm);
    updateKnob(knob, readout, param);
    sendParam(param);
  }

  knob.addEventListener("pointerdown", (event) => {
    knob.setPointerCapture(event.pointerId);
    startY = event.clientY;
    startNorm = normalize(param, param.value);
  });

  knob.addEventListener("pointermove", (event) => {
    if (!knob.hasPointerCapture(event.pointerId)) {
      return;
    }
    setNorm(startNorm + (startY - event.clientY) / 180);
  });

  knob.addEventListener("wheel", (event) => {
    event.preventDefault();
    setNorm(normalize(param, param.value) - Math.sign(event.deltaY) * 0.015);
  }, { passive: false });

  knob.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      setNorm(normalize(param, param.value) + 0.01);
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      setNorm(normalize(param, param.value) - 0.01);
    }
  });

  updateKnob(knob, readout, param);
  paramViews.set(param.key, { type: "knob", knob, readout });
  control.append(label, knob, readout);
  return control;
}

function createChoice(param) {
  const control = document.createElement("div");
  control.className = "control choice";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = param.name;

  const select = document.createElement("select");
  param.choices.forEach((choice, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = choice;
    select.append(option);
  });
  select.value = String(param.value);
  select.addEventListener("change", () => {
    param.value = Number(select.value);
    sendParam(param);
  });

  paramViews.set(param.key, { type: "choice", select });
  control.append(label, select);
  return control;
}

function updateOctaveKnob(knob, readout) {
  const norm = (octaveOffset - octaveMin) / (octaveMax - octaveMin);
  knob.style.setProperty("--angle", `${-135 + norm * 270}deg`);
  knob.style.setProperty("--arc", `${norm * 270}deg`);
  knob.setAttribute("aria-valuenow", String(octaveOffset));
  readout.textContent = octaveOffset === 0 ? "0 oct" : `${octaveOffset > 0 ? "+" : ""}${octaveOffset} oct`;
}

function setOctaveOffset(value) {
  octaveOffset = Math.min(octaveMax, Math.max(octaveMin, Math.round(value)));
  if (octaveView) {
    updateOctaveKnob(octaveView.knob, octaveView.readout);
  }
}

function createOctaveControl() {
  const control = document.createElement("div");
  control.className = "control";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = "Octave";

  const knob = document.createElement("div");
  knob.className = "knob";
  knob.tabIndex = 0;
  knob.setAttribute("role", "slider");
  knob.setAttribute("aria-valuemin", String(octaveMin));
  knob.setAttribute("aria-valuemax", String(octaveMax));

  const readout = document.createElement("div");
  readout.className = "readout";

  let startY = 0;
  let startValue = 0;

  knob.addEventListener("pointerdown", (event) => {
    knob.setPointerCapture(event.pointerId);
    startY = event.clientY;
    startValue = octaveOffset;
  });

  knob.addEventListener("pointermove", (event) => {
    if (!knob.hasPointerCapture(event.pointerId)) {
      return;
    }
    setOctaveOffset(startValue + (startY - event.clientY) / 28);
  });

  knob.addEventListener("wheel", (event) => {
    event.preventDefault();
    setOctaveOffset(octaveOffset - Math.sign(event.deltaY));
  }, { passive: false });

  knob.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      setOctaveOffset(octaveOffset + 1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      setOctaveOffset(octaveOffset - 1);
    }
  });

  octaveView = { knob, readout };
  updateOctaveKnob(knob, readout);
  control.append(label, knob, readout);
  return control;
}

function applyPreset(name, shouldSend = true) {
  const values = presetValues[name];
  if (!values) {
    return;
  }

  selectedPresetId = name;
  Object.entries(values).forEach(([key, value]) => setParamValue(key, value, shouldSend));
}

function createPresetControl() {
  const control = document.createElement("div");
  control.className = "control choice";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = "Preset";

  const select = document.createElement("select");
  presetDefinitions.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    select.append(option);
  });

  select.value = selectedPresetId;
  select.addEventListener("change", () => applyPreset(select.value));

  control.classList.add("preset-choice");
  control.append(label, select);
  return control;
}

function createControl(param) {
  return param.type === "choice" ? createChoice(param) : createKnob(param);
}

function createSectionControl(key) {
  if (key === "__octave") {
    return createOctaveControl();
  }
  if (key === "__preset") {
    return createPresetControl();
  }
  return createControl(paramByKey.get(key));
}

function renderSection(section) {
  const wrapper = document.createElement("section");
  wrapper.className = "section";

  const title = document.createElement("h2");
  title.className = "section-title";
  title.textContent = section.title;

  const row = document.createElement("div");
  row.className = "control-row";
  section.keys.forEach((key) => row.append(createSectionControl(key)));

  wrapper.append(title, row);
  controlsRoot.append(wrapper);
}

function renderEnvelopeSection() {
  const header = document.createElement("div");
  header.className = "env-header";

  const label = document.createElement("label");
  label.textContent = "Envelope View";

  const select = document.createElement("select");
  for (let i = 1; i <= 6; i += 1) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = `Envelope ${i}`;
    select.append(option);
  }

  const section = document.createElement("section");
  section.className = "section";
  const title = document.createElement("h2");
  title.className = "section-title";
  const row = document.createElement("div");
  row.className = "control-row";

  function showEnvelope(index) {
    title.textContent = `Envelope ${index}`;
    row.replaceChildren();
    [`env${index}Mode`, `env${index}Target`, `env${index}Amount`, `env${index}Attack`, `env${index}AttackShape`, `env${index}Decay`, `env${index}DecayShape`, `env${index}Sustain`, `env${index}Release`]
      .forEach((key) => row.append(createControl(paramByKey.get(key))));
  }

  select.addEventListener("change", () => showEnvelope(Number(select.value)));
  header.append(label, select);
  section.append(title, row);
  controlsRoot.append(header, section);
  showEnvelope(1);
}

async function boot() {
  await loadPresetDefinitions();
  applyPreset(selectedPresetId, false);
  sections.forEach(renderSection);
  renderEnvelopeSection();
  setStatus("Ready. Press Start Audio.");
}

boot().catch((error) => {
  setStatus(`Preset load failed: ${error.message}`);
});

const keyboardMap = new Map([
  ["z", 48], ["s", 49], ["x", 50], ["d", 51], ["c", 52], ["v", 53],
  ["g", 54], ["b", 55], ["h", 56], ["n", 57], ["j", 58], ["m", 59],
  [",", 60], ["l", 61], [".", 62], [";", 63], ["/", 64],
  ["q", 60], ["2", 61], ["w", 62], ["3", 63], ["e", 64], ["r", 65],
  ["5", 66], ["t", 67], ["6", 68], ["y", 69], ["7", 70], ["u", 71],
  ["i", 72], ["9", 73], ["o", 74], ["0", 75], ["p", 76], ["[", 77],
  ["=", 78], ["]", 79]
]);

function noteName(note) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}

function refreshHeldNotes() {
  heldNotesRoot.replaceChildren();
  [...activeNotes].sort((a, b) => a - b).forEach((note) => {
    const pill = document.createElement("span");
    pill.className = "note-pill";
    pill.textContent = noteName(note);
    heldNotesRoot.append(pill);
  });
}

function noteOn(note, velocity = 0.85) {
  activeNotes.add(note);
  refreshHeldNotes();
  if (dspWorker) {
    dspWorker.postMessage({ type: "noteOn", note, velocity });
  }
}

function noteOff(note) {
  activeNotes.delete(note);
  refreshHeldNotes();
  if (dspWorker) {
    dspWorker.postMessage({ type: "noteOff", note });
  }
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const baseNote = keyboardMap.get(key);
  if (baseNote === undefined || activeKeys.has(key)) {
    return;
  }
  event.preventDefault();
  const note = Math.min(127, Math.max(0, baseNote + octaveOffset * 12));
  activeKeys.set(key, note);
  noteOn(note);
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  const note = activeKeys.get(key);
  if (note === undefined) {
    return;
  }
  event.preventDefault();
  activeKeys.delete(key);
  noteOff(note);
});

async function initMidi() {
  if (!navigator.requestMIDIAccess) {
    setStatus("Audio ready. MIDI unavailable; keyboard active.");
    return;
  }

  try {
    const access = await navigator.requestMIDIAccess();
    const wireInput = (input) => {
      input.onmidimessage = (message) => {
        const [status, note, velocity] = message.data;
        const command = status & 0xf0;
        if (command === 0x90 && velocity > 0) {
          noteOn(note, velocity / 127);
        } else if (command === 0x80 || command === 0x90) {
          noteOff(note);
        }
      };
    };

    access.inputs.forEach(wireInput);
    access.onstatechange = () => access.inputs.forEach(wireInput);
    setStatus(access.inputs.size > 0 ? "Audio ready. MIDI active." : "Audio ready. Keyboard active.");
  } catch (error) {
    setStatus("Audio ready. MIDI denied; keyboard active.");
  }
}

async function startAudio() {
  if (audioContext) {
    return;
  }

  if (!crossOriginIsolated) {
    setStatus("Preparing static isolation. Refresh once, then press Start Audio.");
    return;
  }

  startButton.disabled = true;
  setStatus("Starting audio...");

  audioContext = new AudioContext({ latencyHint: "interactive" });
  await audioContext.audioWorklet.addModule("audio-worklet.js");

  const capacity = 4096;
  const audioBuffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * capacity * 2);
  const stateBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
  audioNode = new AudioWorkletNode(audioContext, "dirtynth-audio", {
    numberOfOutputs: 1,
    outputChannelCount: [2]
  });

  audioNode.port.postMessage({ type: "connect", capacity, audioBuffer, stateBuffer });
  audioNode.connect(audioContext.destination);

  dspWorker = new Worker("dsp-worker.js");
  dspWorker.onmessage = (event) => {
    if (event.data.type === "ready") {
      params.forEach(sendParam);
      initMidi();
    } else if (event.data.type === "error") {
      setStatus(`DSP error: ${event.data.message}`);
      startButton.disabled = false;
    }
  };
  dspWorker.onerror = (event) => {
    setStatus(`DSP worker error: ${event.message}`);
    startButton.disabled = false;
  };
  dspWorker.onmessageerror = () => {
    setStatus("DSP worker message error");
    startButton.disabled = false;
  };

  dspWorker.postMessage({
    type: "init",
    capacity,
    audioBuffer,
    stateBuffer,
    sampleRate: audioContext.sampleRate
  });
}

startButton.addEventListener("click", () => {
  startAudio().catch((error) => {
    setStatus(`Audio failed: ${error.message}`);
    startButton.disabled = false;
  });
});

downloadPresetButton.addEventListener("click", downloadCurrentPreset);

window.addEventListener("blur", () => {
  activeKeys.clear();
  activeNotes.clear();
  refreshHeldNotes();
  if (dspWorker) {
    dspWorker.postMessage({ type: "allNotesOff" });
  }
});
