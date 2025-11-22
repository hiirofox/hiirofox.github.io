// enola-online/js/dsp/Oscillator.js
import { BaseNode } from './BaseNode.js';

export class Oscillator extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.worklet = null;
  }

  initialize(initialValues) {
    const type = initialValues?.type || 'sawtooth';
    const pitch = initialValues?.pitch || 40;
    const pwm = initialValues?.pwm || 0.5;
    const sync = initialValues?.sync || 1.0;

    // 創建 AudioWorkletNode
    // 這裡不需要 Merger 了，Worklet 原生支持多輸入
    // input 0: FREQ
    // input 1: SHIFT
    this.worklet = new AudioWorkletNode(this.context, 'oscillator-processor', {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        outputChannelCount: [1], // 單聲道輸出
        parameterData: {
            pitch: pitch,
            pwm: pwm,
            sync: sync
        }
    });

    // 初始化波形類型 (因為它不是 AudioParam，所以用消息傳遞)
    this.worklet.port.postMessage({ 
        type: 'config', 
        payload: { type: type } 
    });

    // 設置 BaseNode 的接口
    // AudioSystem 連接時，inputIndex 0 會連到 worklet 的 input 0，inputIndex 1 會連到 input 1
    this.input = this.worklet;
    this.output = this.worklet;

    // 綁定參數到 this.params，以便 AudioSystem.updateParam 可以控制它們
    this.params.set('pitch', this.worklet.parameters.get('pitch'));
    this.params.set('pwm', this.worklet.parameters.get('pwm'));
    this.params.set('sync', this.worklet.parameters.get('sync'));

    // 靜音保護
    const silencer = this.context.createGain();
    silencer.gain.value = 0;
    this.output.connect(silencer);
    silencer.connect(this.context.destination);
  }

  setProperty(key, value) {
    if (key === 'type') {
        this.worklet.port.postMessage({ 
            type: 'config', 
            payload: { type: value } 
        });
    } else {
        // 對於 AudioParam 類型的屬性（pitch, pwm, sync），
        // 雖然 AudioSystem 通常會優先檢查 params Map，但作為保險也保留直接設置
        const param = this.worklet.parameters.get(key);
        if (param) {
            param.setValueAtTime(value, this.context.currentTime);
        }
    }
  }

  destroy() {
    if (this.worklet) {
      this.worklet.disconnect();
      this.worklet.port.close(); // 關閉消息端口
    }
    super.destroy();
  }
}