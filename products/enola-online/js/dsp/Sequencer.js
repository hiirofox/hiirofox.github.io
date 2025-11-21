
import { BaseNode } from './BaseNode.js';

export class Sequencer extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.processor = null;
    this.currentStep = 0;
    this.stepValues = [0,0,0,0,0,0,0,0];
    this.lastTrig = 0;
    this.lastReset = 0;
  }

  initialize(initialValues) {
    this.processor = this.context.createScriptProcessor(1024, 2, 1);
    
    for(let i=0; i<8; i++) {
        this.stepValues[i] = initialValues?.[`step${i}`] || 0;
    }

    this.processor.onaudioprocess = (e) => {
      const trigIn = e.inputBuffer.getChannelData(0);
      const resetIn = e.inputBuffer.getChannelData(1);
      const cvOut = e.outputBuffer.getChannelData(0);

      for (let i = 0; i < trigIn.length; i++) {
        const t = trigIn[i];
        const r = resetIn[i];

        if (r > 0.5 && this.lastReset <= 0.5) {
            this.currentStep = 0;
        }

        if (t > 0.5 && this.lastTrig <= 0.5) {
            this.currentStep++;
            if (this.currentStep >= 8) {
                this.currentStep = 0;
            }
        }

        this.lastTrig = t;
        this.lastReset = r;

        cvOut[i] = this.stepValues[this.currentStep];
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
      if (key.startsWith('step')) {
          const index = parseInt(key.replace('step', ''));
          if (!isNaN(index) && index >= 0 && index < 8) {
              this.stepValues[index] = value;
          }
      }
  }
}
