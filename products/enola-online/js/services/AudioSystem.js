// enola-online/js/services/AudioSystem.js
import { NodeType } from '../types.js';
import { Oscillator } from '../dsp/Oscillator.js';
import { Filter } from '../dsp/Filter.js';
import { Gain } from '../dsp/Gain.js';
import { LFO } from '../dsp/LFO.js';
import { Master } from '../dsp/Master.js';
import { Clock } from '../dsp/Clock.js';
import { Sequencer } from '../dsp/Sequencer.js';
import { Envelope } from '../dsp/Envelope.js';
import { Mixer } from '../dsp/Mixer.js'; // [新增引用]

class AudioSystem {
  constructor() {
    this.context = null;
    this.nodes = new Map();
    this.modulesLoaded = false; // 防止重複加載
  }

  getContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.context;
  }

  async resume() {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (!this.modulesLoaded) {
      try {
        // 批量加载所有 Processor
        await Promise.all([
          ctx.audioWorklet.addModule('js/dsp/processors/OscillatorProcessor.js'),
          ctx.audioWorklet.addModule('js/dsp/processors/GainProcessor.js'),
          ctx.audioWorklet.addModule('js/dsp/processors/LFOProcessor.js'),
          ctx.audioWorklet.addModule('js/dsp/processors/ClockProcessor.js'),
          ctx.audioWorklet.addModule('js/dsp/processors/SequencerProcessor.js'),
          ctx.audioWorklet.addModule('js/dsp/processors/EnvelopeProcessor.js'),
          ctx.audioWorklet.addModule('js/dsp/processors/MixerProcessor.js'), // [新增加载]
        ]);

        console.log("All Audio Worklet Modules Loaded");
        this.modulesLoaded = true;
      } catch (e) {
        console.error("Failed to load audio worklets", e);
      }
    }
  }

  createNode(id, type, initialValues) {
    const ctx = this.getContext();
    let node = null;

    // 確保模塊已加載（針對 Oscillator）
    // 如果是首次點擊初始化，resume() 會被調用並等待加載完成
    // 但如果是後續動態添加節點，邏輯也是安全的

    switch (type) {
      case NodeType.OSCILLATOR: node = new Oscillator(id, ctx); break;
      case NodeType.FILTER: node = new Filter(id, ctx); break;
      case NodeType.GAIN: node = new Gain(id, ctx); break;
      case NodeType.LFO: node = new LFO(id, ctx); break;
      case NodeType.MASTER: node = new Master(id, ctx); break;
      case NodeType.CLOCK: node = new Clock(id, ctx); break;
      case NodeType.SEQUENCER: node = new Sequencer(id, ctx); break;
      case NodeType.ENVELOPE: node = new Envelope(id, ctx); break;
      case NodeType.MIXER: node = new Mixer(id, ctx); break; // [新增 Case]
      default:
        console.warn(`Unknown node type: ${type}`);
        return;
    }

    if (node) {
      node.initialize(initialValues);
      this.nodes.set(id, node);
    }
  }

  removeNode(id) {
    const node = this.nodes.get(id);
    if (node) {
      node.destroy();
      this.nodes.delete(id);
    }
  }

  updateParam(id, param, value) {
    const node = this.nodes.get(id);
    if (!node) return;

    const audioParam = node.params.get(param);
    // 檢查是否為 AudioParam 實例
    if (audioParam && typeof audioParam.setTargetAtTime === 'function' && typeof value === 'number') {
      audioParam.setTargetAtTime(value, this.getContext().currentTime, 0.05);
    } else {
      node.setProperty(param, value);
    }
  }
  connect(sourceId, targetId, sourceHandle, targetHandle) {
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);
    if (!sourceNode || !targetNode) return;

    let outputIndex = 0;
    if (sourceHandle === 'output-trig') outputIndex = 0;
    if (sourceHandle === 'output-div') outputIndex = 1;

    let inputIndex = 0;
    let isParam = false;
    let paramName = '';

    // [修改连接逻辑] 解析 input-X
    if (targetHandle === 'input' || targetHandle === 'input-trig' || targetHandle === 'input-freq' || targetHandle === 'input-rate') {
      inputIndex = 0;
    } else if (targetHandle === 'input-reset' || targetHandle === 'input-shift' || targetHandle === 'input-cv') {
      inputIndex = 1;
    } else if (targetHandle.startsWith('input-')) {
      // 处理 input-0, input-1, input-2, input-3
      const part = targetHandle.replace('input-', '');
      const idx = parseInt(part);
      if (!isNaN(idx)) inputIndex = idx;
    } else if (targetHandle.startsWith('param-')) {
      isParam = true;
      paramName = targetHandle.replace('param-', '');
    }

    try {
      if (isParam) {
        const targetParam = targetNode.params.get(paramName);
        if (targetParam) sourceNode.output.connect(targetParam, outputIndex);
      } else if (targetNode.input) {
        sourceNode.output.connect(targetNode.input, outputIndex, inputIndex);
      }
    } catch (e) { console.error("Connection failed", e); }
  }

  disconnect(sourceId, targetId, sourceHandle, targetHandle) {
    // ... 逻辑与 connect 类似 ...
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);
    if (!sourceNode || !targetNode) return;

    let outputIndex = 0;
    if (sourceHandle === 'output-div') outputIndex = 1;

    let inputIndex = 0;
    let isParam = false;
    let paramName = '';

    if (targetHandle === 'input-reset' || targetHandle === 'input-shift' || targetHandle === 'input-cv') inputIndex = 1;

    // [新增] Disconnect 也要处理 input-X
    if (targetHandle.startsWith('input-')) {
      const part = targetHandle.replace('input-', '');
      const idx = parseInt(part);
      if (!isNaN(idx)) inputIndex = idx;
    }

    if (targetHandle.startsWith('param-')) {
      isParam = true;
      paramName = targetHandle.replace('param-', '');
    }

    try {
      if (isParam) {
        const targetParam = targetNode.params.get(paramName);
        if (targetParam) sourceNode.output.disconnect(targetParam, outputIndex);
      } else if (targetNode.input) {
        sourceNode.output.disconnect(targetNode.input, outputIndex, inputIndex);
      }
    } catch (e) { }
  }
}
export const audioSystem = new AudioSystem();