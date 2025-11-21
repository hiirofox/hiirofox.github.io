
import { BaseNode } from './BaseNode.js';

export class Clock extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.processor = null;
    this.samplesPerBeat = 0;
    this.counter = 0;
    this.divCounter = 0;
    this.isHigh = false;
    this.bpm = 120;
    this.sampleRate = 44100;
  }

  initialize(initialValues) {
    this.sampleRate = this.context.sampleRate;
    this.bpm = initialValues?.bpm || 120;
    this.updateTimings();

    this.processor = this.context.createScriptProcessor(1024, 0, 2);
    
    this.processor.onaudioprocess = (e) => {
      const out0 = e.outputBuffer.getChannelData(0);
      const out1 = e.outputBuffer.getChannelData(1);
      
      for (let i = 0; i < out0.length; i++) {
        this.counter++;
        
        const pulseWidthSamples = Math.floor(0.01 * this.sampleRate);
        
        if (this.counter >= this.samplesPerBeat) {
            this.counter = 0;
            this.isHigh = true;
            this.divCounter++;
            if (this.divCounter >= 8) {
                this.divCounter = 0;
            }
        }

        if (this.counter > pulseWidthSamples) {
            this.isHigh = false;
        }

        const signal = this.isHigh ? 1.0 : 0.0;
        out0[i] = signal;
        out1[i] = (this.divCounter === 0 && this.isHigh) ? 1.0 : 0.0;
      }
    };

    this.output = this.processor;
    
    const silencer = this.context.createGain();
    silencer.gain.value = 0;
    this.output.connect(silencer);
    silencer.connect(this.context.destination);
  }

  updateTimings() {
     this.samplesPerBeat = (60 / this.bpm) * this.sampleRate * 0.5; 
  }

  setProperty(key, value) {
    if (key === 'bpm') {
        this.bpm = value;
        this.updateTimings();
    }
  }
}
