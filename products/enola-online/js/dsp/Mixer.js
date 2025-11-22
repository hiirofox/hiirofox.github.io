import { BaseNode } from './BaseNode.js';

export class Mixer extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.worklet = null;
  }

  initialize(initialValues) {
    // 准备初始增益值
    const paramData = {};
    for(let i=0; i<4; i++) {
        paramData[`gain${i}`] = initialValues?.[`gain${i}`] !== undefined ? initialValues[`gain${i}`] : 1.0;
    }

    // 创建 Worklet: 4 输入, 1 输出
    this.worklet = new AudioWorkletNode(this.context, 'mixer-processor', {
        numberOfInputs: 4, 
        numberOfOutputs: 1,
        outputChannelCount: [1],
        parameterData: paramData
    });

    // 输入/输出直接指向 Worklet
    // AudioWorklet 支持多输入，连接时通过 inputIndex 区分
    this.input = this.worklet;
    this.output = this.worklet;

    // 绑定参数
    for(let i=0; i<4; i++) {
        this.params.set(`gain${i}`, this.worklet.parameters.get(`gain${i}`));
    }

    // 静音保护
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
    if (this.worklet) this.worklet.disconnect();
    super.destroy();
  }
}