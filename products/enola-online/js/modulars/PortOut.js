import { BaseNode } from './BaseNode.js';
import { createNodeShell, createPort, createControlRow } from '../ui/UIBuilder.js';
import { NodeType } from '../types.js';

export class PortOut extends BaseNode {
  static meta = {
    type: NodeType.PORT_OUT,
    label: 'PORT OUT',
    shortLabel: 'OUT',
    initialValues: { 
      label: 'OUTPUT' 
    }
  };

  static renderUI(id, data, onChange, onContext) {
    const { root, body } = createNodeShell(id, this.meta.label, this.meta.shortLabel, 'min-w-[120px]', onContext);

    // PortOut在Macro内部作为输入端口
    createPort(body, 'IN', 'input', 'target', 'left', '50%');

    // 控制区域
    const controls = createControlRow(body, "flex items-center justify-center px-4 py-3");

    // 端口标签输入框
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = data.values.label || 'OUTPUT';
    labelInput.className = 'nodrag bg-black border border-[#00FF00] text-[#00FF00] text-[11px] px-2 py-1 w-full text-center uppercase';
    labelInput.placeholder = 'PORT LABEL';
    labelInput.addEventListener('input', (e) => {
      const newLabel = e.target.value.toUpperCase();
      onChange(id, 'label', newLabel);
      // 通知Macro模块更新端口标签
      if (window.macroManager) {
        window.macroManager.updatePortLabel(id, newLabel);
      }
    });
    
    controls.appendChild(labelInput);

    return root;
  }

  constructor(id, context) {
    super(id, context);
    this.gainNode = null;
  }

  initialize(initialValues) {
    // PortOut作为信号透传节点
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 1.0;
    
    this.input = this.gainNode;
    this.output = this.gainNode;
    
    // 连接到静音输出以避免音频警告
    const silencer = this.context.createGain();
    silencer.gain.value = 0;
    this.output.connect(silencer);
    silencer.connect(this.context.destination);
  }

  setProperty(key, value) {
    // PortOut模块主要处理标签更新，不需要音频参数处理
    if (key === 'label') {
      // 标签更新由UI处理
    }
  }

  destroy() {
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
    super.destroy();
  }
}