import { BaseNode } from './BaseNode.js';
import { createNodeShell, createPort } from '../ui/UIBuilder.js';
import { NodeType } from '../types.js';

export class Master extends BaseNode {
  static meta = {
    type: NodeType.MASTER,
    label: 'OUTPUT',
    shortLabel: 'MASTER',
    workletPath: null,
    initialValues: {}
  };

  static renderUI(id, data, onChange, onContext) {
    const { root, body } = createNodeShell(id, this.meta.label, this.meta.shortLabel, 'min-w-[120px]', onContext);
    
    const container = document.createElement('div');
    container.className = "flex justify-center items-center py-2 px-4 w-full";
    container.innerHTML = `<div class="flex justify-center items-center w-full h-[46px] bg-[#050505] border-y border-[#111]"><span class="text-[#00FF00] text-[9px] font-arial">STEREO OUT</span></div>`;

    body.appendChild(container);
    createPort(body, 'IN', 'input', 'target', 'left', '50%');
    
    return root;
  }

  constructor(id, context) {
    super(id, context);
    this.limiter = null;
  }

  initialize(initialValues) {
    this.limiter = this.context.createDynamicsCompressor();
    this.limiter.threshold.value = -1.0;
    this.limiter.connect(this.context.destination);
    this.input = this.limiter;
  }
}