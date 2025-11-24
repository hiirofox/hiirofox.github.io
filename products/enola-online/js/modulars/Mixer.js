import { BaseNode } from './BaseNode.js';
import { Knob } from '../ui/Knob.js';
import { createNodeShell, createPort, STANDARD_KNOB_SIZE } from '../ui/UIBuilder.js';
import { NodeType } from '../types.js';

export class Mixer extends BaseNode {
  static meta = {
    type: NodeType.MIXER,
    label: 'MIXER',
    shortLabel: 'MIX',
    workletPath: 'js/modulars/processors/MixerProcessor.js',
    initialValues: { gain0: 1, gain1: 1, gain2: 1, gain3: 1 }
  };

  static renderUI(id, data, onChange, onContext) {
    const { root, body } = createNodeShell(id, this.meta.label, this.meta.shortLabel, 'min-w-[240px]', onContext);

    createPort(body, '1', 'input-0', 'target', 'left', '20%');
    createPort(body, '2', 'input-1', 'target', 'left', '40%');
    createPort(body, '3', 'input-2', 'target', 'left', '60%');
    createPort(body, '4', 'input-3', 'target', 'left', '80%');
    createPort(body, 'OUT', 'output', 'source', 'right', '50%');

    const content = document.createElement('div');
    content.className = "flex flex-row items-center justify-center w-full p-2 gap-2 pl-2 pr-4";

    for (let i = 0; i < 4; i++) {
        new Knob(content, {
            size: 36,
            label: `CH${i + 1}`,
            value: data.values[`gain${i}`] !== undefined ? data.values[`gain${i}`] : 1.0,
            min: 0, max: 2,
            onChange: (v) => onChange(id, `gain${i}`, v)
        });
    }

    body.appendChild(content);
    return root;
  }

  constructor(id, context) {
    super(id, context);
    this.worklet = null;
  }

  initialize(initialValues) {
    const paramData = {};
    for(let i=0; i<4; i++) {
        paramData[`gain${i}`] = initialValues?.[`gain${i}`] !== undefined ? initialValues[`gain${i}`] : 1.0;
    }

    this.worklet = new AudioWorkletNode(this.context, 'mixer-processor', {
        numberOfInputs: 4, 
        numberOfOutputs: 1,
        outputChannelCount: [1],
        parameterData: paramData
    });

    this.input = this.worklet;
    this.output = this.worklet;

    for(let i=0; i<4; i++) {
        this.params.set(`gain${i}`, this.worklet.parameters.get(`gain${i}`));
    }

    const silencer = this.context.createGain();
    silencer.gain.value = 0;
    this.output.connect(silencer);
    silencer.connect(this.context.destination);
  }

  setProperty(key, value) {
    const param = this.worklet.parameters.get(key);
    if (param) {
        param.setValueAtTime(value, this.context.currentTime);
    }
  }

  destroy() {
    if (this.worklet) this.worklet.disconnect();
    super.destroy();
  }
}