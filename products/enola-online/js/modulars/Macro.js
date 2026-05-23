import { BaseNode } from './BaseNode.js';
import { createNodeShell, createPort, createControlRow } from '../ui/UIBuilder.js';
import { NodeType } from '../types.js';

export class Macro extends BaseNode {
  static meta = {
    type: NodeType.MACRO,
    label: 'MACRO',
    shortLabel: 'MACRO',
    initialValues: { 
      label: 'MACRO',
      internalNodes: [],
      internalEdges: [],
      internalView: { x: 0, y: 0, scale: 1.0 },
      dynamicPorts: { inputs: [], outputs: [] }
    }
  };

  static renderUI(id, data, onChange, onContext) {
    const { root, body } = createNodeShell(id, this.meta.label, this.meta.shortLabel, 'min-w-[160px]', onContext);

    // 动态创建端口
    const dynamicPorts = data.values.dynamicPorts || { inputs: [], outputs: [] };
    
    // 创建输入端口
    dynamicPorts.inputs.forEach((port, index) => {
      const topPercent = dynamicPorts.inputs.length === 1 ? '50%' : 
                       `${20 + (index * 60 / (dynamicPorts.inputs.length - 1))}%`;
      createPort(body, port.label, `input-${port.id}`, 'target', 'left', topPercent);
    });

    // 创建输出端口
    dynamicPorts.outputs.forEach((port, index) => {
      const topPercent = dynamicPorts.outputs.length === 1 ? '50%' : 
                        `${20 + (index * 60 / (dynamicPorts.outputs.length - 1))}%`;
      createPort(body, port.label, `output-${port.id}`, 'source', 'right', topPercent);
    });

    // 控制区域
    const controls = createControlRow(body, "flex flex-col items-center justify-center px-4 py-3 gap-2");

    // Macro标签输入框
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = data.values.label || 'MACRO';
    labelInput.className = 'nodrag bg-black border border-[#00FF00] text-[#00FF00] text-[11px] px-2 py-1 w-full text-center uppercase';
    labelInput.placeholder = 'MACRO NAME';
    labelInput.addEventListener('input', (e) => {
      onChange(id, 'label', e.target.value.toUpperCase());
    });
    controls.appendChild(labelInput);

    // 内部Knob控件容器
    const knobsContainer = document.createElement('div');
    knobsContainer.className = "flex flex-wrap gap-1 justify-center max-w-full";
    knobsContainer.id = `macro-knobs-${id}`;
    
    // 渲染内部Knob控件
    if (data.values.internalNodes) {
      data.values.internalNodes.forEach(node => {
        if (node.type === 'KNOB') {
          const knobElement = Macro.createMacroKnob(node, onChange);
          knobsContainer.appendChild(knobElement);
        }
      });
    }
    
    controls.appendChild(knobsContainer);

    // 双击进入内部编辑
    root.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (window.macroManager) {
        window.macroManager.enterMacro(id);
      }
    });

    return root;
  }

  // 创建Macro表面的Knob控件
  static createMacroKnob(knobNode, onChange) {
    const container = document.createElement('div');
    container.className = "flex flex-col items-center gap-1";
    
    // 小型旋钮
    const knobDiv = document.createElement('div');
    knobDiv.className = "w-6 h-6 bg-black border border-[#00FF00] rounded-full relative cursor-pointer";
    knobDiv.style.transform = `rotate(${((knobNode.data.values.value - knobNode.data.values.min) / (knobNode.data.values.max - knobNode.data.values.min)) * 270 - 135}deg)`;
    
    // 旋钮指示器
    const indicator = document.createElement('div');
    indicator.className = "absolute w-0.5 h-2 bg-[#00FF00] top-0.5 left-1/2 transform -translate-x-1/2 origin-bottom";
    knobDiv.appendChild(indicator);
    
    // 标签
    const label = document.createElement('div');
    label.className = "text-[8px] text-[#00FF00] text-center max-w-[30px] truncate";
    label.textContent = knobNode.data.values.label || 'KNOB';
    
    // 鼠标交互
    let isDragging = false;
    let startY = 0;
    let startValue = knobNode.data.values.value;
    
    knobDiv.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      startY = e.clientY;
      startValue = knobNode.data.values.value;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
    
    function onMouseMove(e) {
      if (!isDragging) return;
      const deltaY = startY - e.clientY;
      const range = knobNode.data.values.max - knobNode.data.values.min;
      const newValue = Math.max(knobNode.data.values.min, 
                       Math.min(knobNode.data.values.max, 
                               startValue + (deltaY * range * 0.01)));
      
      // 更新内部knob节点的值
      onChange(knobNode.id, 'value', newValue);
      
      // 更新UI
      knobDiv.style.transform = `rotate(${((newValue - knobNode.data.values.min) / range) * 270 - 135}deg)`;
    }
    
    function onMouseUp() {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    
    container.appendChild(knobDiv);
    container.appendChild(label);
    
    return container;
  }

  constructor(id, context) {
    super(id, context);
    this.internalNodes = new Map();
    this.internalEdges = [];
    this.dynamicInputs = new Map();
    this.dynamicOutputs = new Map();
  }

  initialize(initialValues) {
    const defaults = Macro.meta.initialValues;
    
    // Macro模块本身不处理音频，只是作为容器
    // 音频处理通过内部的PortIn/PortOut节点进行
    
    // 初始化动态端口
    const dynamicPorts = initialValues?.dynamicPorts || defaults.dynamicPorts;
    
    // 创建输入端口的音频节点
    dynamicPorts.inputs.forEach(port => {
      const gainNode = this.context.createGain();
      gainNode.gain.value = 1.0;
      this.dynamicInputs.set(port.id, gainNode);
    });
    
    // 创建输出端口的音频节点
    dynamicPorts.outputs.forEach(port => {
      const gainNode = this.context.createGain();
      gainNode.gain.value = 1.0;
      this.dynamicOutputs.set(port.id, gainNode);
    });
    
    // 如果有输入端口，第一个作为主输入
    if (this.dynamicInputs.size > 0) {
      this.input = this.dynamicInputs.values().next().value;
    }
    
    // 如果有输出端口，第一个作为主输出
    if (this.dynamicOutputs.size > 0) {
      this.output = this.dynamicOutputs.values().next().value;
      
      // 连接到静音输出以避免音频警告
      const silencer = this.context.createGain();
      silencer.gain.value = 0;
      this.output.connect(silencer);
      silencer.connect(this.context.destination);
    }
  }

  setProperty(key, value) {
    if (key === 'label') {
      // 标签更新由UI处理
    } else if (key.startsWith('internal-')) {
      // 处理内部节点的参数更新
      const nodeId = key.replace('internal-', '');
      // 这里需要与MacroManager配合处理内部节点的参数更新
      if (window.macroManager) {
        window.macroManager.updateInternalNodeParam(this.id, nodeId, value);
      }
    }
  }

  // 添加动态端口
  addDynamicPort(type, portId, label) {
    const gainNode = this.context.createGain();
    gainNode.gain.value = 1.0;
    
    if (type === 'input') {
      this.dynamicInputs.set(portId, gainNode);
      if (!this.input) this.input = gainNode;
    } else if (type === 'output') {
      this.dynamicOutputs.set(portId, gainNode);
      if (!this.output) {
        this.output = gainNode;
        // 连接到静音输出
        const silencer = this.context.createGain();
        silencer.gain.value = 0;
        this.output.connect(silencer);
        silencer.connect(this.context.destination);
      }
    }
  }

  // 移除动态端口
  removeDynamicPort(type, portId) {
    if (type === 'input' && this.dynamicInputs.has(portId)) {
      const node = this.dynamicInputs.get(portId);
      node.disconnect();
      this.dynamicInputs.delete(portId);
    } else if (type === 'output' && this.dynamicOutputs.has(portId)) {
      const node = this.dynamicOutputs.get(portId);
      node.disconnect();
      this.dynamicOutputs.delete(portId);
    }
  }

  // 获取动态端口的音频节点
  getDynamicPort(type, portId) {
    if (type === 'input') {
      return this.dynamicInputs.get(portId);
    } else if (type === 'output') {
      return this.dynamicOutputs.get(portId);
    }
    return null;
  }

  destroy() {
    // 清理所有动态端口
    this.dynamicInputs.forEach(node => node.disconnect());
    this.dynamicOutputs.forEach(node => node.disconnect());
    this.dynamicInputs.clear();
    this.dynamicOutputs.clear();
    
    super.destroy();
  }
}