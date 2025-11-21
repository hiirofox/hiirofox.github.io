
import { BaseNode } from './BaseNode.js';

export class Oscillator extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.processor = null;
    this.type = 'sawtooth';
    this.pitch = 40;
    this.pwm = 0.5;
    this.sync = 1.0;
    this.masterPhase = 0;
    this.slavePhase = 0;
    this.sampleRate = 44100;
    this.DIV12 = 1.0 / 12.0;
  }

  initialize(initialValues) {
    this.sampleRate = this.context.sampleRate;
    this.type = initialValues?.type || 'sawtooth';
    this.pitch = initialValues?.pitch || 40;
    this.pwm = initialValues?.pwm || 0.5;
    this.sync = initialValues?.sync || 1.0;

    this.processor = this.context.createScriptProcessor(1024, 2, 1);
    
    this.processor.onaudioprocess = (e) => {
      const freqIn = e.inputBuffer.getChannelData(0);
      const shiftIn = e.inputBuffer.getChannelData(1);
      const out = e.outputBuffer.getChannelData(0);
      
      for (let i = 0; i < out.length; i++) {
        const inF = freqIn[i]; 
        const inS = shiftIn[i];

        const baseHz = inF;
        const exponent = (this.pitch + inS) * this.DIV12;
        const offsetHz = Math.pow(2, exponent);
        const finalBaseFreq = Math.max(0, baseHz + offsetHz);
        
        const slaveFreq = finalBaseFreq * this.sync;

        const masterStep = finalBaseFreq / this.sampleRate;
        const slaveStep = slaveFreq / this.sampleRate;

        this.masterPhase += masterStep;
        
        if (this.masterPhase >= 1.0) {
            this.masterPhase -= 1.0;
            this.slavePhase = 0; 
        }

        this.slavePhase += slaveStep;
        if (this.slavePhase >= 1.0) this.slavePhase -= 1.0;

        let sample = 0;
        switch (this.type) {
            case 'sawtooth':
                sample = 2.0 * (this.slavePhase - 0.5);
                break;
            case 'square':
                sample = this.slavePhase < this.pwm ? 1.0 : -1.0;
                break;
            case 'sine':
                sample = Math.sin(this.slavePhase * 2.0 * Math.PI);
                break;
            case 'triangle':
                sample = 4.0 * Math.abs(this.slavePhase - 0.5) - 1.0;
                break;
        }
        out[i] = sample;
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
    if (key === 'type') this.type = value;
    if (key === 'pitch') this.pitch = value;
    if (key === 'pwm') this.pwm = value;
    if (key === 'sync') this.sync = value;
  }

  destroy() {
    if (this.processor) {
        this.processor.disconnect();
        this.processor.onaudioprocess = null;
    }
    super.destroy();
  }
}
