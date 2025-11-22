import { BaseNode } from './BaseNode.js';

export class Gain extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.worklet = null;
  }

  initialize(initialValues) {
    const gainVal = initialValues?.gain !== undefined ? initialValues.gain : 0.5;

    this.worklet = new AudioWorkletNode(this.context, 'gain-processor', {
        numberOfInputs: 2, // 0: Audio, 1: CV
        numberOfOutputs: 1,
        outputChannelCount: [1],
        parameterData: {
            gain: gainVal
        }
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
    if (this.worklet) {
        this.worklet.disconnect();
    }
    super.destroy();
  }
}