import { BaseNode } from './BaseNode.js';
import { Knob as KnobUI } from '../ui/Knob.js';
import { createNodeShell, createPort, createControlRow, STANDARD_KNOB_SIZE } from '../ui/UIBuilder.js';
import { NodeType } from '../types.js';

export class Knob extends BaseNode {
  static meta = {
    type: NodeType.KNOB,
    label: 'KNOB',
    shortLabel: 'KNOB',
    initialValues: { 
      value: 0.5, 
      min: 0.0, 
      max: 1.0, 
      label: 'KNOB' 
    }
  };

  static renderUI(id, data, onChange, onContext) {
    const { root, body } = createNodeShell(id, this.meta.label, this.meta.shortLabel, 'min-w-[140px]', onContext);

    // 输出端口
    createPort(body, 'OUT', 'output', 'source', 'right', '50%');

    // 控制区域 - 垂直布局
    const controls = createControlRow(body, "flex flex-col items-center justify-center px-4 py-3 gap-2");

    // 输入框区域 - 垂直排列
    const inputsContainer = document.createElement('div');
    inputsContainer.className = "flex flex-col gap-1 w-full";

    // 标签输入框
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = data.values.label || 'KNOB';
    labelInput.className = 'nodrag bg-black border border-[#00FF00] text-[#00FF00] text-[10px] px-1 py-0.5 w-full text-center';
    labelInput.addEventListener('input', (e) => {
      onChange(id, 'label', e.target.value);
    });
    inputsContainer.appendChild(labelInput);

    // 最小值输入框
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.value = data.values.min || 0.0;
    minInput.step = '0.01';
    minInput.className = 'nodrag bg-black border border-[#00FF00] text-[#00FF00] text-[10px] px-1 py-0.5 w-full text-center';
    minInput.placeholder = 'MIN';
    minInput.addEventListener('input', (e) => {
      const newMin = parseFloat(e.target.value) || 0;
      onChange(id, 'min', newMin);
      // 确保当前值在新的范围内
      const currentValue = data.values.value || 0.5;
      const max = data.values.max || 1.0;
      if (currentValue < newMin) {
        onChange(id, 'value', newMin);
      }
    });
    inputsContainer.appendChild(minInput);

    // 最大值输入框
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.value = data.values.max || 1.0;
    maxInput.step = '0.01';
    maxInput.className = 'nodrag bg-black border border-[#00FF00] text-[#00FF00] text-[10px] px-1 py-0.5 w-full text-center';
    maxInput.placeholder = 'MAX';
    maxInput.addEventListener('input', (e) => {
      const newMax = parseFloat(e.target.value) || 1.0;
      onChange(id, 'max', newMax);
      // 确保当前值在新的范围内
      const currentValue = data.values.value || 0.5;
      const min = data.values.min || 0.0;
      if (currentValue > newMax) {
        onChange(id, 'value', newMax);
      }
    });
    inputsContainer.appendChild(maxInput);

    controls.appendChild(inputsContainer);

    // 旋钮控件 - 水平排列
    const knobContainer = document.createElement('div');
    knobContainer.className = "flex justify-center mt-1";
    
    new KnobUI(knobContainer, { 
      size: STANDARD_KNOB_SIZE, 
      label: data.values.label || 'KNOB', 
      value: data.values.value || 0.5, 
      min: data.values.min || 0.0, 
      max: data.values.max || 1.0, 
      onChange: (v) => onChange(id, 'value', v) 
    });
    
    controls.appendChild(knobContainer);

    return root;
  }

  constructor(id, context) {
    super(id, context);
    this.gainNode = null;
  }

  initialize(initialValues) {
    const defaults = Knob.meta.initialValues;
    const value = initialValues?.value !== undefined ? initialValues.value : defaults.value;
    
    // 创建一个常量音频源来提供DC输出
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = value;
    
    // 创建一个静音的振荡器作为信号源
    const oscillator = this.context.createOscillator();
    oscillator.frequency.value = 0; // DC信号
    oscillator.type = 'sine';
    
    oscillator.connect(this.gainNode);
    oscillator.start();
    
    this.output = this.gainNode;
    this.input = null; // Knob模块没有输入
    
    // 连接到静音输出以避免音频警告
    const silencer = this.context.createGain();
    silencer.gain.value = 0;
    this.output.connect(silencer);
    silencer.connect(this.context.destination);
  }

  setProperty(key, value) {
    if (key === 'value' && this.gainNode) {
      // 更新DC输出值
      this.gainNode.gain.setValueAtTime(value, this.context.currentTime);
    }
    // min, max, label 只影响UI，不影响音频处理
  }

  destroy() {
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
    super.destroy();
  }
}