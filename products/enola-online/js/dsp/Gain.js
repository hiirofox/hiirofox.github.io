import { BaseNode } from './BaseNode.js';

export class Gain extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.processor = null;
    this.merger = null;
    this.amount = 0.5;
  }

  initialize(initialValues) {
    this.amount = initialValues?.gain !== undefined ? initialValues.gain : 0.5;

    // Merger Input 0: Audio Signal
    // Merger Input 1: CV Control
    this.merger = this.context.createChannelMerger(2);
    this.processor = this.context.createScriptProcessor(1024, 2, 1);
    this.merger.connect(this.processor);

    this.processor.onaudioprocess = (e) => {
        const audioIn = e.inputBuffer.getChannelData(0);
        const cvIn = e.inputBuffer.getChannelData(1);
        const out = e.outputBuffer.getChannelData(0);

        // 如果没有 CV 连接，cvIn 是全 0 数组，这正是我们想要的
        for (let i=0; i<out.length; i++) {
            const audio = audioIn[i];
            const cv = cvIn[i];
            
            let control = cv + this.amount;
            // 简单钳位，防止负增益导致反相
            if (control < 0) control = 0;

            out[i] = audio * control;
        }
    };

    this.input = this.merger;
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
    if (this.merger) this.merger.disconnect();
    super.destroy();
  }
}