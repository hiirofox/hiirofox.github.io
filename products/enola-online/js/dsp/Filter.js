import { BaseNode } from './BaseNode.js';

export class Filter extends BaseNode {
  constructor(id, context) {
      super(id, context);
      this.filter = null;
      // 路由節點
      this.merger = null;
      this.splitter = null;
      this.cvGain = null;
  }

  initialize(initialValues) {
    // 1. 創建原生濾波器
    this.filter = this.context.createBiquadFilter();
    this.filter.type = initialValues?.type || 'lowpass';
    this.filter.frequency.value = initialValues?.frequency || 1000;
    this.filter.Q.value = initialValues?.q || 1;

    // 2. 創建路由系統以支持 CV 輸入
    // 使用 ChannelMerger(2) 來接收兩個輸入：
    // Input 0: 音頻信號 (Audio)
    // Input 1: 控制電壓 (CV)
    this.merger = this.context.createChannelMerger(2);
    this.splitter = this.context.createChannelSplitter(2);
    
    // 將合併的信號發送到分離器
    this.merger.connect(this.splitter);

    // 3. 音頻路徑 (Channel 0 -> Filter)
    // 注意：BiquadFilter 默認處理單聲道或立體聲，這裡我們取分離出的第0通道
    this.splitter.connect(this.filter, 0, 0);

    // 4. CV 路徑 (Channel 1 -> Scaler -> Filter.detune)
    // 創建一個增益節點作為 Scaler (縮放器)
    this.cvGain = this.context.createGain();
    
    // 設置靈敏度：輸入 1.0 = 2400 音分 (2個八度)
    // 這解決了 "LFO 信號太弱" 的問題，也帶來了更自然的對數掃頻效果
    this.cvGain.gain.value = 2400; 

    this.splitter.connect(this.cvGain, 1, 0);
    this.cvGain.connect(this.filter.detune);

    // 5. 設置對外接口
    // AudioSystem 會連接到 this.input (merger)
    // input-cv 會自動映射到 merger 的 index 1
    this.input = this.merger;
    this.output = this.filter;

    // 6. 參數映射
    // 旋鈕依然控制 Base Frequency (基準頻率)
    this.params.set('frequency', this.filter.frequency);
    this.params.set('q', this.filter.Q);
  }

  setProperty(key, value) {
    if (key === 'type' && this.filter) {
      this.filter.type = value;
    }
  }

  destroy() {
    // 清理所有創建的節點
    if (this.merger) this.merger.disconnect();
    if (this.splitter) this.splitter.disconnect();
    if (this.cvGain) this.cvGain.disconnect();
    if (this.filter) this.filter.disconnect();
    super.destroy();
  }
}