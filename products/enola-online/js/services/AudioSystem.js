// js/services/AudioSystem.js
import { NodeType } from '../types.js';
import { ModuleRegistry } from '../ModuleRegistry.js';
import { WasmService } from './WasmService.js';

class AudioSystem {
  constructor() {
    this.context = null;
    this.nodes = new Map();
    this.modulesLoaded = false;
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
      const worklets = ModuleRegistry.getAllWorklets();
      try {
        await Promise.all(worklets.map(path => ctx.audioWorklet.addModule(path)));
        console.log("[AudioSystem] Audio Worklets Ready");
        this.modulesLoaded = true;
      } catch (e) {
        console.error("[AudioSystem] Worklet Load Error:", e);
      }
    }
  }

  async createNode(id, type, initialValues) {
    const ctx = this.getContext();
    const NodeClass = ModuleRegistry.getClass(type);

    if (NodeClass) {
      const node = new NodeClass(id, ctx);
      try {
        node.initialize(initialValues);
        this.nodes.set(id, node);

        // 统一加载 WASM 逻辑
        if (NodeClass.meta.wasmPath && node.worklet) {
          // console.log(`[AudioSystem] 🚀 Fetching WASM for ${type}...`);
          const buffer = await WasmService.loadModule(NodeClass.meta.wasmPath);

          if (buffer) {
            node.worklet.port.postMessage({
              type: 'load-wasm',
              payload: { wasmBuffer: buffer } // 必须是 wasmBuffer
            });
          }
        }
      } catch (err) {
        console.error(`[AudioSystem] Init Error ${type}:`, err);
      }
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

    if (targetHandle === 'input' || targetHandle === 'input-trig' || targetHandle === 'input-freq' || targetHandle === 'input-rate') {
      inputIndex = 0;
    } else if (targetHandle === 'input-reset' || targetHandle === 'input-shift' || targetHandle === 'input-cv') {
      inputIndex = 1;
    } else if (targetHandle.startsWith('input-')) {
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
    } catch (e) { }
  }

  disconnect(sourceId, targetId, sourceHandle, targetHandle) {
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);
    if (!sourceNode || !targetNode) return;

    let outputIndex = 0;
    if (sourceHandle === 'output-div') outputIndex = 1;

    let inputIndex = 0;
    let isParam = false;
    let paramName = '';

    if (targetHandle === 'input-reset' || targetHandle === 'input-shift' || targetHandle === 'input-cv') inputIndex = 1;

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