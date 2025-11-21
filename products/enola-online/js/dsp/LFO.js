import { BaseNode } from './BaseNode.js';

export class LFO extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.processor = null;
    this.merger = null;
    this.type = 'sine';
    this.frequency = 5;
    this.gain = 100;
    this.phase = 0;
    this.lastReset = 0;
    this.sampleRate = 44100;
  }

  initialize(initialValues) {
    this.sampleRate = this.context.sampleRate;
    this.type = initialValues?.type || 'sine';
    this.frequency = initialValues?.frequency || 5;
    this.gain = initialValues?.gain || 100;

    // Input 0: Rate CV, Input 1: Reset Trig
    this.merger = this.context.createChannelMerger(2);
    this.processor = this.context.createScriptProcessor(1024, 2, 1);
    this.merger.connect(this.processor);

    this.processor.onaudioprocess = (e) => {
      const rateIn = e.inputBuffer.getChannelData(0);
      const resetIn = e.inputBuffer.getChannelData(1);
      const out = e.outputBuffer.getChannelData(0);
      const g = this.gain / 1000.0;

      for (let i = 0; i < out.length; i++) {
        const rMod = rateIn[i];
        const reset = resetIn[i];

        if (reset > 0.5 && this.lastReset <= 0.5) {
          this.phase = 0;
        }
        this.lastReset = reset;

        let currentFreq = this.frequency + (rMod * 100.0);

        this.phase += currentFreq / this.sampleRate;
        if (this.phase >= 1.0) this.phase -= 1.0;
        if (this.phase < 0) this.phase += 1.0;

        let sample = 0;
        switch (this.type) {
          case 'sawtooth':
            sample = 2.0 * (this.phase - 0.5);
            break;
          case 'square':
            sample = this.phase < 0.5 ? 1.0 : -1.0;
            break;
          case 'sine':
            sample = Math.sin(this.phase * 2.0 * Math.PI);
            break;
        }
        out[i] = sample * g;
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
    if (key === 'type') this.type = value;
    if (key === 'frequency') this.frequency = value;
    if (key === 'gain') this.gain = value;
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