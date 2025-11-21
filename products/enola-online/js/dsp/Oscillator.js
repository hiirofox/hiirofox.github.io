import { BaseNode } from './BaseNode.js';

export class Oscillator extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.processor = null;
    this.merger = null; // 新增 Merger
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

    // 关键修改：创建一个拥有 2 个输入端口的 Merger
    this.merger = this.context.createChannelMerger(2);

    // Processor 依然接收 2 个声道（来自 Merger 的合并）
    this.processor = this.context.createScriptProcessor(1024, 2, 1);

    // 连接：Merger -> Processor
    this.merger.connect(this.processor);

    this.processor.onaudioprocess = (e) => {
      // 这里的 ChannelData(0) 对应 Merger 的 Input 0 (FREQ)
      // ChannelData(1) 对应 Merger 的 Input 1 (SHIFT)
      const freqIn = e.inputBuffer.getChannelData(0);
      const shiftIn = e.inputBuffer.getChannelData(1);
      const out = e.outputBuffer.getChannelData(0);

      for (let i = 0; i < out.length; i++) {
        const inF = freqIn[i]; // 这里的 buffer 是自动归零的，如果没有连接则是 0
        const inS = shiftIn[i];

        const baseHz = inF * 500.0;
        const exponent = (this.pitch + inS * 24.0) * this.DIV12;
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

    // 关键：对外暴露的 input 是 merger，这样 AudioSystem 连线时可以区分 Input 0 和 Input 1
    this.input = this.merger;
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
    if (this.merger) {
      this.merger.disconnect();
    }
    super.destroy();
  }
}