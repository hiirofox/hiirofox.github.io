import { BaseNode } from './BaseNode.js';

export class Clock extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.worklet = null;
    this.splitter = null; // 新增 Splitter
  }

  initialize(initialValues) {
    const bpm = initialValues?.bpm || 120;

    // Worklet 產生一個立體聲輸出 (Ch0: Trig, Ch1: Div)
    this.worklet = new AudioWorkletNode(this.context, 'clock-processor', {
        numberOfInputs: 0, 
        numberOfOutputs: 1,
        outputChannelCount: [2], 
        parameterData: {
            bpm: bpm
        }
    });

    // [關鍵修復] 創建分離器，將 1 個立體聲輸出拆分為 2 個單聲道輸出
    this.splitter = this.context.createChannelSplitter(2);
    
    // Worklet -> Splitter
    this.worklet.connect(this.splitter);

    // 將 output 指向 Splitter
    // 這樣 AudioSystem 調用 connect(target, 0) 時連接 Trig
    // 調用 connect(target, 1) 時連接 Div
    this.output = this.splitter;

    this.params.set('bpm', this.worklet.parameters.get('bpm'));

    // 保持活躍 (連接 Splitter 的任一輸出到 destination 即可保持上游活躍)
    const silencer = this.context.createGain();
    silencer.gain.value = 0;
    this.splitter.connect(silencer, 0); // 連接 Output 0
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