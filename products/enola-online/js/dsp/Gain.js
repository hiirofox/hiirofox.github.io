
import { BaseNode } from './BaseNode.js';

export class Gain extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.processor = null;
    this.amount = 0.5;
  }

  initialize(initialValues) {
    this.amount = initialValues?.gain !== undefined ? initialValues.gain : 0.5;

    this.processor = this.context.createScriptProcessor(1024, 2, 1);

    this.processor.onaudioprocess = (e) => {
        const audioIn = e.inputBuffer.getChannelData(0);
        const cvIn = e.inputBuffer.getChannelData(1);
        const out = e.outputBuffer.getChannelData(0);

        for (let i=0; i<out.length; i++) {
            const audio = audioIn[i];
            const cv = cvIn[i];
            
            let control = cv + this.amount;

            out[i] = audio * control;
        }
    };

    this.input = this.processor;
    this.output = this.processor;

    const silencer = this.context.createGain();
    silencer.gain.value = 0;
    this.output.connect(silencer);
    silencer.connect(this.context.destination);
  }

  setProperty(key, value) {
      if (key === 'gain') {
          this.amount = value;
      }
  }

  destroy() {
    if (this.processor) {
        this.processor.disconnect();
        this.processor.onaudioprocess = null;
    }
    super.destroy();
  }
}
