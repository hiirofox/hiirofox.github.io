import { BaseNode } from './BaseNode.js';
import { Knob } from '../ui/Knob.js';
import { createNodeShell, createPort, createControlRow, STANDARD_KNOB_SIZE } from '../ui/UIBuilder.js';
import { NodeType } from '../types.js';

export class Clock extends BaseNode {
  static meta = {
    type: NodeType.CLOCK,
    label: 'CLOCK',
    shortLabel: 'CLK',
    workletPath: 'js/dsp/processors/ClockProcessor.js',
    initialValues: { bpm: 120 }
  };

  static renderUI(id, data, onChange, onContext) {
    const { root, body } = createNodeShell(id, this.meta.label, this.meta.shortLabel, 'min-w-[120px]', onContext);
    
    createPort(body, 'TRIG', 'output-trig', 'source', 'right', '30%');
    createPort(body, '/ 8', 'output-div', 'source', 'right', '70%');

    const controls = createControlRow(body);
    new Knob(controls, { size: STANDARD_KNOB_SIZE, label: 'BPM', value: data.values.bpm || 120, min: 40, max: 240, onChange: (v) => onChange(id, 'bpm', v) });
    
    return root;
  }

  constructor(id, context) {
    super(id, context);
    this.worklet = null;
    this.splitter = null; 
  }

  initialize(initialValues) {
    const bpm = initialValues?.bpm || Clock.meta.initialValues.bpm;

    this.worklet = new AudioWorkletNode(this.context, 'clock-processor', {
        numberOfInputs: 0, 
        numberOfOutputs: 1,
        outputChannelCount: [2], 
        parameterData: { bpm }
    });

    this.splitter = this.context.createChannelSplitter(2);
    this.worklet.connect(this.splitter);
    this.output = this.splitter;
    this.params.set('bpm', this.worklet.parameters.get('bpm'));

    const silencer = this.context.createGain();
    silencer.gain.value = 0;
    this.splitter.connect(silencer, 0); 
    silencer.connect(this.context.destination);
  }

  setProperty(key, value) {
    if (key === 'bpm') {
      const param = this.worklet.parameters.get('bpm');
      if(param) param.setValueAtTime(value, this.context.currentTime);
    }
  }
  
  destroy() {
      if(this.worklet) this.worklet.disconnect();
      if(this.splitter) this.splitter.disconnect();
      super.destroy();
  }
}