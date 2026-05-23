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
const originalValues = Object.fromEntries(params.map((param) => [param.key, param.value]));
let octaveView = null;

function makeBasePreset(overrides = {}) {
  const values = {
    octave: 0,
    master: 0.7,
    grain: 4,
    pmDepth: 0,
    oscMix: 0,
    oscAmp: 0,
    osc1WtPos: 0.5,
    osc1Pitch: 0,
    osc1Detune: 0,
    osc1MutAType: 2,
    osc1MutA1: 0,
    osc1MutA2: 0,
    osc1MutA3: 0,
    osc1MutBType: 2,
    osc1MutB1: 0,
    osc1MutB2: 0,
    osc1MutB3: 0,
    osc2WtPos: 0.5,
    osc2Pitch: 0,
    osc2Detune: 0,
    osc2MutAType: 2,
    osc2MutA1: 0,
    osc2MutA2: 0,
    osc2MutA3: 0,
    osc2MutBType: 2,
    osc2MutB1: 0,
    osc2MutB2: 0,
    osc2MutB3: 0,
    filt1Type: 0,
    filt1Cutoff: 20000,
    filt1KeyTrack: 0,
    filt1Reso: 0.707,
    filt1Morph: 0,
    filt2Type: 0,
    filt2Cutoff: 20000,
    filt2KeyTrack: 0,
    filt2Reso: 0.707,
    filt2Morph: 0,
    filt2SwitchIn: 0,
    filtMix: 0,
  };

  for (let i = 1; i <= 6; i += 1) {
    Object.assign(values, {
      [`env${i}Mode`]: 0,
      [`env${i}Target`]: 0,
      [`env${i}Amount`]: 0,
      [`env${i}Attack`]: 5,
      [`env${i}AttackShape`]: -1,
      [`env${i}Decay`]: 160,
      [`env${i}DecayShape`]: -2,
      [`env${i}Sustain`]: 0,
      [`env${i}Release`]: 80
    });
  }

  return { ...values, ...overrides };
}

const fallbackPresetDefinitions = [
  {
    id: "preset0",
    name: "Preset 0 Saw Init",
    values: makeBasePreset({
      env1Target: 9,
      env1Amount: 1,
      env1Decay: 100,
      env1Sustain: 1,
      env1Release: 80
    })
  },
  {
    id: "preset1",
    name: "Preset 1 Dirtynth",
    values: makeBasePreset({
      ...originalValues,
      pmDepth: 0,
      oscAmp: 0,
      env1Target: 9,
      env1Amount: 0.92,
      env1Attack: 4,
      env1Decay: 260,
      env1Sustain: 0.72,
      env1Release: 180,
      env3Target: 0,
      env3Amount: 0
    })
  },
  {
    id: "preset2",
    name: "Preset 2 Shard Pluck",
    values: makeBasePreset({
      master: 0.72,
      grain: 1,
      oscMix: 0.62,
      osc1WtPos: 0.08,
      osc1Pitch: 0,
      osc1Detune: -11,
      osc1MutAType: 1,
      osc1MutA1: 0.94,
      osc1MutA2: 0.72,
      osc1MutA3: 0.86,
      osc1MutBType: 3,
      osc1MutB1: 0.68,
      osc1MutB2: 0.92,
      osc1MutB3: 0.54,
      osc2WtPos: 0.91,
      osc2Pitch: 24,
      osc2Detune: 17,
      osc2MutAType: 1,
      osc2MutA1: 0.82,
      osc2MutA2: 0.64,
      osc2MutA3: 0.78,
      osc2MutBType: 2,
      osc2MutB1: 0.46,
      osc2MutB2: 0.18,
      osc2MutB3: 0.36,
      filt1Type: 2,
      filt1Cutoff: 980,
      filt1KeyTrack: 0.92,
      filt1Reso: 9.5,
      filt1Morph: 0.93,
      filt2Type: 3,
      filt2Cutoff: 1400,
      filt2KeyTrack: 1,
      filt2Reso: 4.8,
      filt2Morph: 0.88,
      filt2SwitchIn: 0.92,
      filtMix: 0.56,
      env1Target: 9,
      env1Amount: 0.96,
      env1Attack: 0.3,
      env1AttackShape: -4,
      env1Decay: 78,
      env1DecayShape: -5,
      env1Sustain: 0,
      env1Release: 210,
      env2Target: 22,
      env2Amount: 0.88,
      env2Attack: 0.4,
      env2AttackShape: -3,
      env2Decay: 96,
      env2DecayShape: -5,
      env2Sustain: 0,
      env2Release: 120,
      env3Target: 31,
      env3Amount: 0.82,
      env3Attack: 0.5,
      env3AttackShape: -3,
      env3Decay: 130,
      env3DecayShape: -4,
      env3Sustain: 0,
      env3Release: 160,
      env4Target: 2,
      env4Amount: -0.62,
      env4Attack: 0.6,
      env4Decay: 110,
      env4DecayShape: -4,
      env4Sustain: 0,
      env4Release: 120
    })
  },
  {
    id: "preset3",
    name: "Preset 3 Comb Harp",
    values: makeBasePreset({
      master: 0.68,
      grain: 2,
      oscMix: 0.5,
      osc1WtPos: 0.42,
      osc1MutAType: 0,
      osc1MutA1: 0.36,
      osc1MutA2: 0.48,
      osc1MutA3: 0.22,
      osc1MutBType: 3,
      osc1MutB1: 0.28,
      osc1MutB2: 0.40,
      osc1MutB3: 0.20,
      osc2WtPos: 0.72,
      osc2Pitch: 7,
      osc2Detune: -7,
      osc2MutAType: 1,
      osc2MutA1: 0.45,
      osc2MutA2: 0.12,
      osc2MutA3: 0.34,
      filt1Type: 3,
      filt1Cutoff: 1800,
      filt1KeyTrack: 0.8,
      filt1Reso: 1.1,
      filt1Morph: 0.58,
      filt2Type: 4,
      filt2Cutoff: 2400,
      filt2KeyTrack: 0.6,
      filt2Reso: 1.4,
      filt2Morph: 0.42,
      filt2SwitchIn: 0.65,
      filtMix: 0.45,
      env1Target: 9,
      env1Amount: 0.95,
      env1Attack: 0.6,
      env1Decay: 520,
      env1Sustain: 0.18,
      env1Release: 420,
      env2Target: 31,
      env2Amount: 0.55,
      env2Attack: 10,
      env2Decay: 900,
      env2Sustain: 0.25,
      env2Release: 500
    })
  },
  {
    id: "preset4",
    name: "Preset 4 Wide Phaser Pad",
    values: makeBasePreset({
      master: 0.62,
      grain: 5,
      oscMix: 0.52,
      osc1WtPos: 0.18,
      osc1Detune: -9,
      osc1MutAType: 3,
      osc1MutA1: 0.30,
      osc1MutA2: 0.56,
      osc1MutA3: 0.42,
      osc1MutBType: 1,
      osc1MutB1: 0.22,
      osc1MutB2: 0.44,
      osc1MutB3: 0.20,
      osc2WtPos: 0.82,
      osc2Pitch: 0,
      osc2Detune: 11,
      osc2MutAType: 3,
      osc2MutA1: 0.54,
      osc2MutA2: 0.26,
      osc2MutA3: 0.46,
      osc2MutBType: 0,
      osc2MutB1: 0.24,
      osc2MutB2: 0.30,
      osc2MutB3: 0.22,
      filt1Type: 5,
      filt1Cutoff: 3200,
      filt1KeyTrack: 0.2,
      filt1Reso: 2.1,
      filt1Morph: 0.74,
      filt2Type: 0,
      filt2Cutoff: 7600,
      filt2KeyTrack: 0.12,
      filt2Reso: 1.0,
      filt2Morph: 0.2,
      filt2SwitchIn: 0.28,
      filtMix: 0.62,
      env1Target: 9,
      env1Amount: 0.82,
      env1Attack: 900,
      env1Decay: 1800,
      env1Sustain: 0.78,
      env1Release: 2600,
      env2Target: 22,
      env2Amount: 0.34,
      env2Attack: 1400,
      env2Decay: 2400,
      env2Sustain: 0.45,
      env2Release: 2800,
      env3Target: 28,
      env3Amount: 0.35,
      env3Attack: 1800,
      env3Decay: 2600,
      env3Sustain: 0.5,
      env3Release: 2600
    })
  },
  {
    id: "preset5",
    name: "Preset 5 Kickizer Bass",
    values: makeBasePreset({
      master: 0.82,
      grain: 2,
      oscMix: 0.12,
      osc1WtPos: 0.52,
      osc1Pitch: -12,
      osc1Detune: 0,
      osc1MutAType: 2,
      osc1MutA1: 0.72,
      osc1MutA2: 0.48,
      osc1MutA3: 0.30,
      osc1MutBType: 2,
      osc1MutB1: 0.36,
      osc1MutB2: 0.22,
      osc1MutB3: 0.18,
      osc2WtPos: 0.36,
      osc2Pitch: -12,
      osc2Detune: -3,
      osc2MutAType: 2,
      osc2MutA1: 0.44,
      osc2MutA2: 0.28,
      osc2MutA3: 0.16,
      filt1Type: 1,
      filt1Cutoff: 780,
      filt1KeyTrack: 0.45,
      filt1Reso: 1.8,
      filt1Morph: 0.08,
      env1Target: 9,
      env1Amount: 1,
      env1Attack: 0.8,
      env1Decay: 260,
      env1Sustain: 0.38,
      env1Release: 120,
      env2Target: 22,
      env2Amount: 0.62,
      env2Attack: 0.8,
      env2Decay: 210,
      env2Sustain: 0,
      env2Release: 90
    })
  },
  {
    id: "preset6",
    name: "Preset 6 Disperser Choir",
    values: makeBasePreset({
      master: 0.6,
      grain: 5,
      oscMix: 0.58,
      osc1WtPos: 0.08,
      osc1Pitch: 0,
      osc1Detune: -12,
      osc1MutAType: 3,
      osc1MutA1: 0.68,
      osc1MutA2: 0.60,
      osc1MutA3: 0.35,
      osc1MutBType: 3,
      osc1MutB1: 0.34,
      osc1MutB2: 0.28,
      osc1MutB3: 0.52,
      osc2WtPos: 0.68,
      osc2Pitch: 12,
      osc2Detune: 9,
      osc2MutAType: 3,
      osc2MutA1: 0.42,
      osc2MutA2: 0.74,
      osc2MutA3: 0.48,
      osc2MutBType: 1,
      osc2MutB1: 0.28,
      osc2MutB2: 0.34,
      osc2MutB3: 0.28,
      filt1Type: 0,
      filt1Cutoff: 4600,
      filt1KeyTrack: 0.18,
      filt1Reso: 1.1,
      filt1Morph: 0.5,
      filt2Type: 5,
      filt2Cutoff: 3800,
      filt2Reso: 3.2,
      filt2Morph: 0.66,
      filt2SwitchIn: 0.38,
      filtMix: 0.5,
      env1Target: 9,
      env1Amount: 0.88,
      env1Attack: 620,
      env1Decay: 2400,
      env1Sustain: 0.82,
      env1Release: 3200,
      env2Target: 1,
      env2Amount: 0.18,
      env2Attack: 1600,
      env2Decay: 3400,
      env2Sustain: 0.4,
      env2Release: 2600,
      env3Target: 2,
      env3Amount: -0.16,
      env3Attack: 2100,
      env3Decay: 3600,
      env3Sustain: 0.35,
      env3Release: 2600
    })
  },
  {
    id: "preset7",
    name: "Preset 7 Sync Razor Lead",
    values: makeBasePreset({
      master: 0.7,
      grain: 3,
      oscMix: 0.42,
      osc1WtPos: 0.64,
      osc1Detune: -5,
      osc1MutAType: 0,
      osc1MutA1: 0.76,
      osc1MutA2: 0.28,
      osc1MutA3: 0.58,
      osc1MutBType: 0,
      osc1MutB1: 0.48,
      osc1MutB2: 0.42,
      osc1MutB3: 0.20,
      osc2WtPos: 0.30,
      osc2Pitch: 0,
      osc2Detune: 6,
      osc2MutAType: 1,
      osc2MutA1: 0.52,
      osc2MutA2: 0.30,
      osc2MutA3: 0.34,
      filt1Type: 1,
      filt1Cutoff: 2600,
      filt1KeyTrack: 0.36,
      filt1Reso: 3.8,
      filt1Morph: 0.24,
      filt2Type: 2,
      filt2Cutoff: 8200,
      filt2Reso: 1.8,
      filt2Morph: 0.42,
      filtMix: 0.2,
      env1Target: 9,
      env1Amount: 0.96,
      env1Attack: 5,
      env1Decay: 420,
      env1Sustain: 0.68,
      env1Release: 160,
      env2Target: 22,
      env2Amount: 0.48,
      env2Attack: 4,
      env2Decay: 520,
      env2Sustain: 0.22,
      env2Release: 120,
      env3Target: 10,
      env3Amount: 0.26,
      env3Attack: 6,
      env3Decay: 300,
      env3Sustain: 0,
      env3Release: 120
    })
  },
  {
    id: "preset8",
    name: "Preset 8 Elliptic Teeth",
    values: makeBasePreset({
      master: 0.64,
      grain: 1,
      oscMix: 0.68,
      osc1WtPos: 0.97,
      osc1Pitch: -12,
      osc1Detune: -19,
      osc1MutAType: 2,
      osc1MutA1: 0.74,
      osc1MutA2: 0.92,
      osc1MutA3: 0.68,
      osc1MutBType: 1,
      osc1MutB1: 0.96,
      osc1MutB2: 0.84,
      osc1MutB3: 0.72,
      osc2WtPos: 0.03,
      osc2Pitch: 31,
      osc2Detune: 23,
      osc2MutAType: 3,
      osc2MutA1: 0.78,
      osc2MutA2: 0.88,
      osc2MutA3: 0.64,
      osc2MutBType: 0,
      osc2MutB1: 0.66,
      osc2MutB2: 0.82,
      osc2MutB3: 0.58,
      filt1Type: 2,
      filt1Cutoff: 420,
      filt1KeyTrack: 1,
      filt1Reso: 18,
      filt1Morph: 0.98,
      filt2Type: 5,
      filt2Cutoff: 860,
      filt2KeyTrack: 0.72,
      filt2Reso: 12,
      filt2Morph: 0.91,
      filt2SwitchIn: 0.86,
      filtMix: 0.72,
      env1Target: 9,
      env1Amount: 0.9,
      env1Attack: 0.5,
      env1AttackShape: -4,
      env1Decay: 240,
      env1DecayShape: -5,
      env1Sustain: 0.18,
      env1Release: 180,
      env2Target: 22,
      env2Amount: 0.95,
      env2Attack: 0.5,
      env2AttackShape: -4,
      env2Decay: 310,
      env2DecayShape: -5,
      env2Sustain: 0,
      env2Release: 140,
      env3Target: 28,
      env3Amount: -0.82,
      env3Attack: 0.5,
      env3AttackShape: -4,
      env3Decay: 280,
      env3DecayShape: -5,
      env3Sustain: 0,
      env3Release: 130,
      env4Target: 29,
      env4Amount: 0.76,
      env4Attack: 0.7,
      env4AttackShape: -3,
      env4Decay: 220,
      env4DecayShape: -4,
      env4Sustain: 0,
      env4Release: 120,
      env5Target: 1,
      env5Amount: -0.72,
      env5Attack: 0.7,
      env5Decay: 260,
      env5DecayShape: -4,
      env5Sustain: 0,
      env5Release: 120
    })
  },
  {
    id: "preset9",
    name: "Preset 9 Comb Drone Keys",
    values: makeBasePreset({
      master: 0.56,
      grain: 6,
      oscMix: 0.46,
      osc1WtPos: 0.12,
      osc1Pitch: -12,
      osc1Detune: -6,
      osc1MutAType: 1,
      osc1MutA1: 0.24,
      osc1MutA2: 0.58,
      osc1MutA3: 0.20,
      osc1MutBType: 3,
      osc1MutB1: 0.56,
      osc1MutB2: 0.20,
      osc1MutB3: 0.46,
      osc2WtPos: 0.88,
      osc2Pitch: 0,
      osc2Detune: 13,
      osc2MutAType: 0,
      osc2MutA1: 0.30,
      osc2MutA2: 0.52,
      osc2MutA3: 0.26,
      filt1Type: 3,
      filt1Cutoff: 1200,
      filt1KeyTrack: 1,
      filt1Reso: 2.2,
      filt1Morph: 0.72,
      filt2Type: 4,
      filt2Cutoff: 2600,
      filt2KeyTrack: 0.84,
      filt2Reso: 3.0,
      filt2Morph: 0.54,
      filt2SwitchIn: 0.82,
      filtMix: 0.66,
      env1Target: 9,
      env1Amount: 0.78,
      env1Attack: 35,
      env1Decay: 1400,
      env1Sustain: 0.62,
      env1Release: 1800,
      env2Target: 31,
      env2Amount: -0.32,
      env2Attack: 500,
      env2Decay: 2600,
      env2Sustain: 0.2,
      env2Release: 1600
    })
  },
  {
    id: "preset10",
    name: "Preset 10 SelfPM Bells",
    values: makeBasePreset({
      master: 0.66,
      grain: 1,
      oscMix: 0.5,
      osc1WtPos: 0.26,
      osc1Pitch: 0,
      osc1Detune: -1,
      osc1MutAType: 1,
      osc1MutA1: 0.86,
      osc1MutA2: 0.48,
      osc1MutA3: 0.64,
      osc1MutBType: 1,
      osc1MutB1: 0.42,
      osc1MutB2: 0.72,
      osc1MutB3: 0.30,
      osc2WtPos: 0.62,
      osc2Pitch: 24,
      osc2Detune: 2,
      osc2MutAType: 1,
      osc2MutA1: 0.66,
      osc2MutA2: 0.36,
      osc2MutA3: 0.52,
      osc2MutBType: 2,
      osc2MutB1: 0.16,
      osc2MutB2: 0.08,
      osc2MutB3: 0.12,
      filt1Type: 2,
      filt1Cutoff: 7800,
      filt1KeyTrack: 0.28,
      filt1Reso: 1.5,
      filt1Morph: 0.18,
      filt2Type: 5,
      filt2Cutoff: 5200,
      filt2Reso: 2.0,
      filt2Morph: 0.38,
      filt2SwitchIn: 0.2,
      filtMix: 0.26,
      env1Target: 9,
      env1Amount: 0.9,
      env1Attack: 2,
      env1Decay: 900,
      env1Sustain: 0.12,
      env1Release: 1200,
      env2Target: 1,
      env2Amount: 0.28,
      env2Attack: 2,
      env2Decay: 1200,
      env2Sustain: 0,
      env2Release: 900,
      env3Target: 2,
      env3Amount: -0.24,
      env3Attack: 3,
      env3Decay: 1100,
      env3Sustain: 0,
      env3Release: 900
    })
  },
  {
    id: "preset11",
    name: "Preset 11 Moving Split Pad",
    values: makeBasePreset({
      master: 0.58,
      grain: 5,
      oscMix: 0.48,
      osc1WtPos: 0.34,
      osc1Detune: -14,
      osc1MutAType: 0,
      osc1MutA1: 0.22,
      osc1MutA2: 0.64,
      osc1MutA3: 0.34,
      osc1MutBType: 3,
      osc1MutB1: 0.42,
      osc1MutB2: 0.48,
      osc1MutB3: 0.30,
      osc2WtPos: 0.66,
      osc2Pitch: 12,
      osc2Detune: 14,
      osc2MutAType: 2,
      osc2MutA1: 0.28,
      osc2MutA2: 0.18,
      osc2MutA3: 0.38,
      osc2MutBType: 1,
      osc2MutB1: 0.34,
      osc2MutB2: 0.58,
      osc2MutB3: 0.24,
      filt1Type: 0,
      filt1Cutoff: 1800,
      filt1KeyTrack: 0.18,
      filt1Reso: 3.0,
      filt1Morph: 0.32,
      filt2Type: 5,
      filt2Cutoff: 6400,
      filt2KeyTrack: 0.12,
      filt2Reso: 4.8,
      filt2Morph: 0.82,
      filt2SwitchIn: 0.45,
      filtMix: 0.52,
      env1Target: 9,
      env1Amount: 0.84,
      env1Attack: 1200,
      env1Decay: 2200,
      env1Sustain: 0.86,
      env1Release: 3600,
      env2Target: 30,
      env2Amount: 0.5,
      env2Attack: 1800,
      env2Decay: 2800,
      env2Sustain: 0.48,
      env2Release: 3200,
      env3Target: 31,
      env3Amount: 0.38,
      env3Attack: 800,
      env3Decay: 2200,
      env3Sustain: 0.4,
      env3Release: 2600
    })
  }
];
let presetDefinitions = fallbackPresetDefinitions;
let presetValues = Object.fromEntries(presetDefinitions.map((preset) => [preset.id, preset.values]));
let selectedPresetId = "preset0";
let audioContext = null;
let audioNode = null;
let dspWorker = null;
let statusBase = "Open with node server.js, then press Start Audio.";
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
  try {
    const response = await fetch("presets.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`preset list ${response.status}`);
    }

    const listing = await response.json();
    const files = Array.isArray(listing.files) ? listing.files : [];
    const loaded = [];

    for (const file of files) {
      try {
        const presetResponse = await fetch(`presets/${encodeURIComponent(file)}`, { cache: "no-store" });
        if (!presetResponse.ok) {
          throw new Error(`${file} ${presetResponse.status}`);
        }
        loaded.push(parsePresetFile(file, await presetResponse.text()));
      } catch (error) {
        console.warn(`Skipping preset ${file}`, error);
      }
    }

    if (loaded.length > 0) {
      presetDefinitions = loaded;
      presetValues = Object.fromEntries(presetDefinitions.map((preset) => [preset.id, preset.values]));
      selectedPresetId = presetValues[selectedPresetId] ? selectedPresetId : presetDefinitions[0].id;
    }
  } catch (error) {
    console.warn("Preset folder unavailable; using fallback presets.", error);
  }
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
  setStatus("Open with node server.js, then press Start Audio.");
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
    setStatus("Open through server.js for SharedArrayBuffer.");
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
