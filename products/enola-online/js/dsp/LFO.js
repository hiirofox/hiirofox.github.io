import { BaseNode } from './BaseNode.js';

export class LFO extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.worklet = null;
    this.splitter = null;
    this.analyser = null;
    this.animationFrameId = null;

    // 緩存當前波形類型用於繪圖
    this.currentType = 'sine';
  }

  initialize(initialValues) {
    this.currentType = initialValues?.type || 'sine';
    const freq = initialValues?.frequency || 5;
    const gain = initialValues?.gain || 100;

    // 1. 創建 Worklet
    this.worklet = new AudioWorkletNode(this.context, 'lfo-processor', {
      numberOfInputs: 2, // 0: Rate, 1: Reset
      numberOfOutputs: 1,
      outputChannelCount: [2], // Ch0: Signal, Ch1: Phase
      parameterData: {
        frequency: freq,
        gain: gain
      }
    });

    // 發送初始配置
    this.worklet.port.postMessage({ type: 'config', payload: { type: this.currentType } });

    // 2. 信號分離 (Splitter)
    this.splitter = this.context.createChannelSplitter(2);
    this.worklet.connect(this.splitter);

    // 3. 音頻輸出路徑 (Ch0 -> Output)
    this.output = this.context.createGain();
    this.splitter.connect(this.output, 0, 0);

    // 4. UI 可視化路徑 (Ch1 -> Analyser)
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 128; // 小緩衝，快速響應
    this.splitter.connect(this.analyser, 1, 0);

    // 5. 輸入設置
    this.input = this.worklet;

    // 6. 參數綁定
    this.params.set('frequency', this.worklet.parameters.get('frequency'));
    this.params.set('gain', this.worklet.parameters.get('gain'));

    // 7. 靜音保護 (保持 DSP 活躍)
    const silencer = this.context.createGain();
    silencer.gain.value = 0;
    this.output.connect(silencer);
    silencer.connect(this.context.destination);

    // 啟動繪圖循環
    this.startVisualizer();
  }

  startVisualizer() {
    const update = () => {
      const container = document.getElementById(this.id);
      if (!container) return; // 節點被刪除則停止

      const canvas = container.querySelector('canvas');
      if (canvas) {
        this.draw(canvas);
      }

      this.animationFrameId = requestAnimationFrame(update);
    };
    this.animationFrameId = requestAnimationFrame(update);
  }

  draw(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const halfH = h / 2;

    // 1. 獲取相位 (0.0 ~ 1.0)
    const buffer = new Float32Array(1);
    this.analyser.getFloatTimeDomainData(buffer);
    let phase = buffer[0];

    // 修正相位 (防止微小負值)
    if (phase < 0) phase += 1.0;
    phase = phase % 1.0;

    // 2. 清空畫布
    ctx.clearRect(0, 0, w, h);

    // 3. 繪製靜態波形 (Static Waveform)
    // 這會畫出當前選中波形的一個完整週期
    ctx.beginPath();
    ctx.strokeStyle = '#00FFFF'; // [修改點] 青色波形 0x00ffff
    ctx.lineWidth = 2;

    // 遍歷畫布寬度繪製波形
    for (let x = 0; x <= w; x++) {
      const t = x / w; // 歸一化時間 0.0 -> 1.0
      let y = 0;

      switch (this.currentType) {
        case 'sine':
          // sin(2PI * t) -> -1~1
          y = halfH - Math.sin(t * Math.PI * 2) * (halfH - 4);
          break;
        case 'square':
          // 稍微留邊
          y = (t < 0.5) ? 4 : h - 4;
          break;
        case 'sawtooth':
          // Sawtooth: 2*(t - 0.5)
          // 注意 Canvas Y 軸向下，所以負號反轉
          y = halfH + (2 * (t - 0.5)) * (-halfH + 4);
          break;
        case 'triangle':
          // Triangle: 4 * abs(t - 0.5) - 1
          y = halfH + (4 * (0.5 - Math.abs(t - 0.5)) - 1) * (-halfH + 4);
          break;
        default:
          y = halfH;
      }

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 4. 繪製相位指示條 (Phase Indicator Bar)
    const cursorX = phase * w;

    ctx.beginPath();
    ctx.strokeStyle = '#FFFFFF'; // 白色指示條，對比度高
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]); // 虛線樣式
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, h);
    ctx.stroke();
    ctx.setLineDash([]); // 重置虛線
  }

  setProperty(key, value) {
    if (key === 'type') {
      this.currentType = value; // 更新本地變量以重繪波形
      this.worklet.port.postMessage({ type: 'config', payload: { type: value } });
    } else {
      const param = this.worklet.parameters.get(key);
      if (param) param.setValueAtTime(value, this.context.currentTime);
    }
  }

  destroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.worklet) {
      this.worklet.disconnect();
      this.worklet.port.close();
    }
    if (this.splitter) this.splitter.disconnect();
    super.destroy();
  }
}