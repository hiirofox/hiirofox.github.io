import { BaseNode } from './BaseNode.js';

export class Sequencer extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.worklet = null;
  }

  initialize(initialValues) {
    const paramData = {};
    for(let i=0; i<8; i++) {
        paramData[`step${i}`] = initialValues?.[`step${i}`] || 0;
    }

    this.worklet = new AudioWorkletNode(this.context, 'sequencer-processor', {
        numberOfInputs: 2, // 0: Trig, 1: Reset
        numberOfOutputs: 1,
        outputChannelCount: [1],
        parameterData: paramData
    });

    this.input = this.worklet;
    this.output = this.worklet;

    for(let i=0; i<8; i++) {
        this.params.set(`step${i}`, this.worklet.parameters.get(`step${i}`));
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
    if(this.worklet) this.worklet.disconnect();
    super.destroy();
  }
}