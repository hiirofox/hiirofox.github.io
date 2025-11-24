import { BaseNode } from './BaseNode.js';
import { Knob } from '../ui/Knob.js';
import { Switch } from '../ui/Switch.js';
import { createNodeShell, createPort, STANDARD_KNOB_SIZE } from '../ui/UIBuilder.js';
import { NodeType } from '../types.js';

export class LFO extends BaseNode {
  static meta = {
    type: NodeType.LFO,
    label: 'LFO',
    shortLabel: 'MOD',
    workletPath: 'js/modulars/processors/LFOProcessor.js',
    initialValues: { frequency: 5, gain: 100, type: 'sine' }
  };

  static renderUI(id, data, onChange, onContext) {
    const { root, body } = createNodeShell(id, this.meta.label, this.meta.shortLabel, 'min-w-[320px]', onContext);

    createPort(body, 'RATE', 'input-rate', 'target', 'left', '25%');
    createPort(body, 'RST', 'input-reset', 'target', 'left', '75%');
    createPort(body, 'CV', 'output', 'source', 'right', '50%');

    const content = document.createElement('div');
    content.className = "flex flex-row items-center w-full p-2 gap-4 pl-8 pr-8 justify-between";

    const canvasContainer = document.createElement('div');
    canvasContainer.className = "h-[46px] flex-grow bg-black border border-[#005500] relative";
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 46;
    canvas.className = "w-full h-full";
    canvasContainer.appendChild(canvas);

    const controls = document.createElement('div');
    controls.className = "flex flex-row gap-4 items-center";

    new Switch(controls, {
        value: data.values.type || 'sine',
        options: [{ label: 'SIN', value: 'sine' }, { label: 'SQR', value: 'square' }, { label: 'SAW', value: 'sawtooth' }],
        onChange: (v) => onChange(id, 'type', v)
    });

    new Knob(controls, { size: STANDARD_KNOB_SIZE, label: 'RATE', value: data.values.frequency || 5, min: 0.1, max: 50, onChange: (v) => onChange(id, 'frequency', v) });
    new Knob(controls, { size: STANDARD_KNOB_SIZE, label: 'DPTH', value: data.values.gain || 100, min: 0, max: 1000, onChange: (v) => onChange(id, 'gain', v) });

    content.appendChild(canvasContainer);
    content.appendChild(controls);
    body.appendChild(content);

    return root;
  }

  constructor(id, context) {
    super(id, context);
    this.worklet = null;
    this.splitter = null;
    this.analyser = null;
    this.animationFrameId = null;
    this.currentType = 'sine';
  }

  initialize(initialValues) {
    const defaults = LFO.meta.initialValues;
    this.currentType = initialValues?.type || defaults.type;
    const freq = initialValues?.frequency || defaults.frequency;
    const gain = initialValues?.gain || defaults.gain;

    this.worklet = new AudioWorkletNode(this.context, 'lfo-processor', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      parameterData: { frequency: freq, gain: gain }
    });

    this.worklet.port.postMessage({ type: 'config', payload: { type: this.currentType } });

    this.splitter = this.context.createChannelSplitter(2);
    this.worklet.connect(this.splitter);

    this.output = this.context.createGain();
    this.splitter.connect(this.output, 0, 0);

    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 128;
    this.splitter.connect(this.analyser, 1, 0);

    this.input = this.worklet;
    this.params.set('frequency', this.worklet.parameters.get('frequency'));
    this.params.set('gain', this.worklet.parameters.get('gain'));

    const silencer = this.context.createGain();
    silencer.gain.value = 0;
    this.output.connect(silencer);
    silencer.connect(this.context.destination);

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
    const halfH = h / 2;

    const buffer = new Float32Array(1);
    this.analyser.getFloatTimeDomainData(buffer);
    let phase = buffer[0];
    if (phase < 0) phase += 1.0;
    phase = phase % 1.0;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.strokeStyle = '#00FFFF'; 
    ctx.lineWidth = 2;

    for (let x = 0; x <= w; x++) {
      const t = x / w;
      let y = 0;
      switch (this.currentType) {
        case 'sine': y = halfH - Math.sin(t * Math.PI * 2) * (halfH - 4); break;
        case 'square': y = (t < 0.5) ? 4 : h - 4; break;
        case 'sawtooth': y = halfH + (2 * (t - 0.5)) * (-halfH + 4); break;
        case 'triangle': y = halfH + (4 * (0.5 - Math.abs(t - 0.5)) - 1) * (-halfH + 4); break;
        default: y = halfH;
      }
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const cursorX = phase * w;
    ctx.beginPath();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  setProperty(key, value) {
    if (key === 'type') {
      this.currentType = value;
      this.worklet.port.postMessage({ type: 'config', payload: { type: value } });
    } else {
      const param = this.worklet.parameters.get(key);
      if (param) param.setValueAtTime(value, this.context.currentTime);
    }
  }

  destroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.worklet) {
      this.worklet.disconnect();
      this.worklet.port.close();
    }
    if (this.splitter) this.splitter.disconnect();
    super.destroy();
  }
}