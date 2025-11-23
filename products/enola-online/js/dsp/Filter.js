import { BaseNode } from './BaseNode.js';
import { Knob } from '../ui/Knob.js';
import { Switch } from '../ui/Switch.js';
import { createNodeShell, createPort, createControlRow, STANDARD_KNOB_SIZE } from '../ui/UIBuilder.js';
import { NodeType } from '../types.js';

export class Filter extends BaseNode {
  static meta = {
    type: NodeType.FILTER,
    label: 'FILTER',
    shortLabel: 'VCF',
    workletPath: null, // 原生节点，无 worklet
    initialValues: { frequency: 1000, q: 1, type: 'lowpass' }
  };

  static renderUI(id, data, onChange, onContext) {
    const { root, body } = createNodeShell(id, this.meta.label, this.meta.shortLabel, 'min-w-[160px]', onContext);

    createPort(body, 'IN', 'input', 'target', 'left', '25%');
    createPort(body, 'CTOF', 'input-cv', 'target', 'left', '75%');
    createPort(body, 'OUT', 'output', 'source', 'right', '50%');

    const controls = createControlRow(body);

    new Switch(controls, {
        value: data.values.type || 'lowpass',
        options: [{ label: 'LPF', value: 'lowpass' }, { label: 'HPF', value: 'highpass' }, { label: 'BPF', value: 'bandpass' }],
        onChange: (v) => onChange(id, 'type', v)
    });

    const knobs = document.createElement('div');
    knobs.className = "flex gap-2";
    new Knob(knobs, { size: STANDARD_KNOB_SIZE, label: 'CUT', value: data.values.frequency || 1000, min: 10, max: 24000, onChange: (v) => onChange(id, 'frequency', v) });
    new Knob(knobs, { size: STANDARD_KNOB_SIZE, label: 'RES', value: data.values.q || 1, min: 0, max: 20, onChange: (v) => onChange(id, 'q', v) });
    controls.appendChild(knobs);

    return root;
  }

  constructor(id, context) {
      super(id, context);
      this.filter = null;
      this.merger = null;
      this.splitter = null;
      this.cvGain = null;
  }

  initialize(initialValues) {
    const defaults = Filter.meta.initialValues;
    this.filter = this.context.createBiquadFilter();
    this.filter.type = initialValues?.type || defaults.type;
    this.filter.frequency.value = initialValues?.frequency || defaults.frequency;
    this.filter.Q.value = initialValues?.q || defaults.q;

    this.merger = this.context.createChannelMerger(2);
    this.splitter = this.context.createChannelSplitter(2);
    this.merger.connect(this.splitter);
    this.splitter.connect(this.filter, 0, 0);

    this.cvGain = this.context.createGain();
    this.cvGain.gain.value = 2400; 
    this.splitter.connect(this.cvGain, 1, 0);
    this.cvGain.connect(this.filter.detune);

    this.input = this.merger;
    this.output = this.filter;

    this.params.set('frequency', this.filter.frequency);
    this.params.set('q', this.filter.Q);
  }

  setProperty(key, value) {
    if (key === 'type' && this.filter) {
      this.filter.type = value;
    }
  }

  destroy() {
    if (this.merger) this.merger.disconnect();
    if (this.splitter) this.splitter.disconnect();
    if (this.cvGain) this.cvGain.disconnect();
    if (this.filter) this.filter.disconnect();
    super.destroy();
  }
}