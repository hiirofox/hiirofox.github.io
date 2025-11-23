import { BaseNode } from './BaseNode.js';
import { Knob } from '../ui/Knob.js';
import { createNodeShell, createPort, createControlRow, STANDARD_KNOB_SIZE } from '../ui/UIBuilder.js';
import { NodeType } from '../types.js';

export class Gain extends BaseNode {
  static meta = {
    type: NodeType.GAIN,
    label: 'AMPLIFIER',
    shortLabel: 'VCA',
    workletPath: 'js/dsp/processors/GainProcessor.js',
    initialValues: { gain: 0.5 }
  };

  static renderUI(id, data, onChange, onContext) {
    const { root, body } = createNodeShell(id, this.meta.label, this.meta.shortLabel, 'min-w-[120px]', onContext);
    
    createPort(body, 'IN', 'input', 'target', 'left', '25%');
    createPort(body, 'CV', 'input-cv', 'target', 'left', '75%');
    createPort(body, 'OUT', 'output', 'source', 'right', '50%');

    const controls = createControlRow(body);
    new Knob(controls, { size: STANDARD_KNOB_SIZE, label: 'AMT', value: data.values.gain !== undefined ? data.values.gain : 0.5, min: 0, max: 1, onChange: (v) => onChange(id, 'gain', v) });
    
    return root;
  }

  constructor(id, context) {
    super(id, context);
    this.worklet = null;
  }

  initialize(initialValues) {
    const gainVal = initialValues?.gain !== undefined ? initialValues.gain : Gain.meta.initialValues.gain;

    this.worklet = new AudioWorkletNode(this.context, 'gain-processor', {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        parameterData: { gain: gainVal }
    });

    this.input = this.worklet;
    this.output = this.worklet;
    this.params.set('gain', this.worklet.parameters.get('gain'));

    const silencer = this.context.createGain();
    silencer.gain.value = 0;
    this.output.connect(silencer);
    silencer.connect(this.context.destination);
  }

  setProperty(key, value) {
      if (key === 'gain') {
          const param = this.worklet.parameters.get('gain');
          if(param) param.setValueAtTime(value, this.context.currentTime);
      }
  }

  destroy() {
    if (this.worklet) this.worklet.disconnect();
    super.destroy();
  }
}