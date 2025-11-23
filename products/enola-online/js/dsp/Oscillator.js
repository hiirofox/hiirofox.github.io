import { BaseNode } from './BaseNode.js';
import { Knob } from '../ui/Knob.js';
import { Switch } from '../ui/Switch.js';
import { createNodeShell, createPort, createControlRow, STANDARD_KNOB_SIZE } from '../ui/UIBuilder.js';
import { NodeType } from '../types.js';

export class Oscillator extends BaseNode {
  static meta = {
    type: NodeType.OSCILLATOR,
    label: 'OSCILLATOR',
    shortLabel: 'VCO',
    workletPath: 'js/dsp/processors/OscillatorProcessor.js',
    initialValues: { pitch: 40, type: 'sawtooth', pwm: 0.5, sync: 1.0 }
  };

  static renderUI(id, data, onChange, onContext) {
    const { root, body } = createNodeShell(id, this.meta.label, this.meta.shortLabel, 'min-w-[160px]', onContext);

    createPort(body, 'FREQ', 'input-freq', 'target', 'left', '30%');
    createPort(body, 'SHIFT', 'input-shift', 'target', 'left', '70%');
    createPort(body, 'OUT', 'output', 'source', 'right', '50%');

    const controls = createControlRow(body);

    const switchContainer = document.createElement('div');
    switchContainer.className = "flex flex-col gap-[2px] pl-2 pr-0";
    new Switch(switchContainer, {
        value: data.values.type || 'sawtooth',
        options: [
            { label: 'SAW', value: 'sawtooth' },
            { label: 'SQR', value: 'square' },
            { label: 'SIN', value: 'sine' },
            { label: 'TRI', value: 'triangle' }
        ],
        onChange: (v) => onChange(id, 'type', v)
    });
    controls.appendChild(switchContainer);

    const knobs = document.createElement('div');
    knobs.className = "flex gap-2";
    new Knob(knobs, { size: STANDARD_KNOB_SIZE, label: 'PITCH', value: data.values.pitch || 40, min: 30, max: 180, onChange: (v) => onChange(id, 'pitch', v) });
    new Knob(knobs, { size: STANDARD_KNOB_SIZE, label: 'SYNC', value: data.values.sync || 1.0, min: 0.1, max: 10.0, onChange: (v) => onChange(id, 'sync', v) });
    new Knob(knobs, { size: STANDARD_KNOB_SIZE, label: 'PWM', value: data.values.pwm || 0.5, min: 0.1, max: 0.9, onChange: (v) => onChange(id, 'pwm', v) });
    controls.appendChild(knobs);

    return root;
  }

  constructor(id, context) {
    super(id, context);
    this.worklet = null;
  }

  initialize(initialValues) {
    const defaults = Oscillator.meta.initialValues;
    const type = initialValues?.type || defaults.type;
    const pitch = initialValues?.pitch || defaults.pitch;
    const pwm = initialValues?.pwm || defaults.pwm;
    const sync = initialValues?.sync || defaults.sync;

    this.worklet = new AudioWorkletNode(this.context, 'oscillator-processor', {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        parameterData: { pitch, pwm, sync }
    });

    this.worklet.port.postMessage({ type: 'config', payload: { type } });
    this.input = this.worklet;
    this.output = this.worklet;

    this.params.set('pitch', this.worklet.parameters.get('pitch'));
    this.params.set('pwm', this.worklet.parameters.get('pwm'));
    this.params.set('sync', this.worklet.parameters.get('sync'));

    const silencer = this.context.createGain();
    silencer.gain.value = 0;
    this.output.connect(silencer);
    silencer.connect(this.context.destination);
  }

  setProperty(key, value) {
    if (key === 'type') {
        this.worklet.port.postMessage({ type: 'config', payload: { type: value } });
    } else {
        const param = this.worklet.parameters.get(key);
        if (param) param.setValueAtTime(value, this.context.currentTime);
    }
  }

  destroy() {
    if (this.worklet) {
      this.worklet.disconnect();
      this.worklet.port.close();
    }
    super.destroy();
  }
}