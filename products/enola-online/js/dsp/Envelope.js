import { BaseNode } from './BaseNode.js';
import { Knob } from '../ui/Knob.js';
import { createNodeShell, createPort, STANDARD_KNOB_SIZE } from '../ui/UIBuilder.js';
import { NodeType } from '../types.js';

export class Envelope extends BaseNode {
  static meta = {
    type: NodeType.ENVELOPE,
    label: 'A/D ENVELOPE',
    shortLabel: 'ENV',
    workletPath: 'js/dsp/processors/EnvelopeProcessor.js',
    initialValues: { attack: 0.1, decay: 0.5, gain: 1.0 }
  };

  static renderUI(id, data, onChange, onContext) {
    const { root, body } = createNodeShell(id, this.meta.label, this.meta.shortLabel, 'min-w-[280px]', onContext);

    createPort(body, 'TRIG', 'input', 'target', 'left', '30%');
    createPort(body, 'CV', 'output', 'source', 'right', '50%');

    const content = document.createElement('div');
    content.className = "flex flex-row items-center w-full p-2 gap-4 pl-9 pr-8 justify-between";

    const canvasContainer = document.createElement('div');
    canvasContainer.className = "h-[46px] flex-grow bg-black border border-[#005500] relative";
    const canvas = document.createElement('canvas');
    canvas.width = 140;
    canvas.height = 46;
    canvas.className = "w-full h-full";
    canvasContainer.appendChild(canvas);

    const knobs = document.createElement('div');
    knobs.className = "flex flex-row gap-2";

    new Knob(knobs, { size: 36, label: 'ATK', value: data.values.attack || 0.1, min: 0.001, max: 1.0, onChange: (v) => onChange(id, 'attack', v) });
    new Knob(knobs, { size: 36, label: 'DEC', value: data.values.decay || 0.5, min: 0.001, max: 1.0, onChange: (v) => onChange(id, 'decay', v) });
    new Knob(knobs, { size: 36, label: 'GAIN', value: data.values.gain !== undefined ? data.values.gain : 1.0, min: 0, max: 4, onChange: (v) => onChange(id, 'gain', v) });

    content.appendChild(canvasContainer);
    content.appendChild(knobs);
    body.appendChild(content);

    return root;
  }

  constructor(id, context) {
    super(id, context);
    this.worklet = null;
    this.analyser = null; 
    this.animationFrameId = null;
    this.currentAttack = 0.1;
    this.currentDecay = 0.5;
    this.currentGain = 1.0;
  }

  initialize(initialValues) {
    const defaults = Envelope.meta.initialValues;
    this.currentAttack = initialValues?.attack || defaults.attack;
    this.currentDecay = initialValues?.decay || defaults.decay;
    this.currentGain = initialValues?.gain !== undefined ? initialValues.gain : defaults.gain;

    this.worklet = new AudioWorkletNode(this.context, 'envelope-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2], 
        parameterData: { attack: this.currentAttack, decay: this.currentDecay }
    });

    const splitter = this.context.createChannelSplitter(2);
    this.worklet.connect(splitter);
    
    this.output = this.context.createGain(); 
    this.output.gain.value = this.currentGain; 
    splitter.connect(this.output, 0, 0);

    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 128; 
    splitter.connect(this.analyser, 1, 0);

    this.input = this.worklet;
    this.startVisualizer();
  }

  startVisualizer() {
    const update = () => {
        const container = document.getElementById(this.id);
        if (!container) return; 
        const canvas = container.querySelector('canvas');
        if (canvas) this.draw(canvas);
        this.animationFrameId = requestAnimationFrame(update);
    };
    this.animationFrameId = requestAnimationFrame(update);
  }

  draw(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    const buffer = new Float32Array(1);
    this.analyser.getFloatTimeDomainData(buffer);
    const phase = buffer[0]; 

    ctx.clearRect(0, 0, w, h);

    const total = this.currentAttack + this.currentDecay;
    const safeTotal = total < 0.001 ? 0.001 : total;
    const attackRatio = this.currentAttack / safeTotal;
    const peakX = w * attackRatio;

    ctx.beginPath();
    ctx.strokeStyle = '#00FFFF'; 
    ctx.lineWidth = 2;
    
    ctx.moveTo(0, h); 
    ctx.lineTo(peakX, 1); 
    
    if (w > peakX) {
        for (let x = Math.floor(peakX); x <= w; x++) {
            const progress = (x - peakX) / (w - peakX);
            const clampedProgress = Math.max(0, Math.min(1, progress));
            const linearVal = 1.0 - clampedProgress;
            const yVal = Math.pow(linearVal, 3.0);
            const plotY = h - (yVal * h);
            ctx.lineTo(x, plotY);
        }
    } else {
        ctx.lineTo(w, h);
    }
    ctx.stroke();

    if (phase > 0.001 && phase < 0.999) {
        const lineX = phase * w;
        ctx.beginPath();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]); 
        ctx.moveTo(lineX, 0);
        ctx.lineTo(lineX, h);
        ctx.stroke();
        ctx.setLineDash([]); 
    }
  }

  setProperty(key, value) {
    if (key === 'attack') {
        this.currentAttack = value;
        const param = this.worklet.parameters.get('attack');
        if (param) param.setValueAtTime(value, this.context.currentTime);
    }
    if (key === 'decay') {
        this.currentDecay = value;
        const param = this.worklet.parameters.get('decay');
        if (param) param.setValueAtTime(value, this.context.currentTime);
    }
    if (key === 'gain') {
        this.currentGain = value;
        this.output.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
    }
  }

  destroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.worklet) this.worklet.disconnect();
    super.destroy();
  }
}