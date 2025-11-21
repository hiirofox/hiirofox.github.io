
import { NodeType } from '../types.js';
import { Oscillator } from '../dsp/Oscillator.js';
import { Filter } from '../dsp/Filter.js';
import { Gain } from '../dsp/Gain.js';
import { LFO } from '../dsp/LFO.js';
import { Master } from '../dsp/Master.js';
import { Clock } from '../dsp/Clock.js';
import { Sequencer } from '../dsp/Sequencer.js';

class AudioSystem {
  constructor() {
    this.context = null;
    this.nodes = new Map();
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
  }

  createNode(id, type, initialValues) {
    const ctx = this.getContext();
    let node = null;

    switch (type) {
      case NodeType.OSCILLATOR:
        node = new Oscillator(id, ctx);
        break;
      case NodeType.FILTER:
        node = new Filter(id, ctx);
        break;
      case NodeType.GAIN:
        node = new Gain(id, ctx);
        break;
      case NodeType.LFO:
        node = new LFO(id, ctx);
        break;
      case NodeType.MASTER:
        node = new Master(id, ctx);
        break;
      case NodeType.CLOCK:
        node = new Clock(id, ctx);
        break;
      case NodeType.SEQUENCER:
        node = new Sequencer(id, ctx);
        break;
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
    if (audioParam && typeof value === 'number') {
      audioParam.setTargetAtTime(value, this.getContext().currentTime, 0.05);
    } else {
      node.setProperty(param, value);
    }
  }

  connect(sourceId, targetId, sourceHandle, targetHandle) {
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);
    
    if (!sourceNode || !targetNode) return;
    if (!sourceNode.output) return;

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
    } else if (targetHandle.startsWith('param-')) {
        isParam = true;
        paramName = targetHandle.replace('param-', '');
    }

    try {
        if (isParam) {
            const targetParam = targetNode.params.get(paramName);
            if (targetParam) {
                sourceNode.output.connect(targetParam, outputIndex);
            }
        } else if (targetNode.input) {
            sourceNode.output.connect(targetNode.input, outputIndex, inputIndex);
        }
    } catch (e) {
        console.error("Connection failed", e);
    }
  }

  disconnect(sourceId, targetId, sourceHandle, targetHandle) {
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);

    if (!sourceNode || !targetNode) return;
    if (!sourceNode.output) return;

    let outputIndex = 0;
    if (sourceHandle === 'output-div') outputIndex = 1;
    
    let inputIndex = 0;
    let isParam = false;
    let paramName = '';

    if (targetHandle === 'input-reset' || targetHandle === 'input-shift' || targetHandle === 'input-cv') inputIndex = 1;

    if (targetHandle.startsWith('param-')) {
        isParam = true;
        paramName = targetHandle.replace('param-', '');
    }

    try {
        if (isParam) {
             const targetParam = targetNode.params.get(paramName);
             if(targetParam) sourceNode.output.disconnect(targetParam, outputIndex);
        } else if (targetNode.input) {
             sourceNode.output.disconnect(targetNode.input, outputIndex, inputIndex);
        }
    } catch(e){
        // Fallback
    }
  }
}

export const audioSystem = new AudioSystem();
