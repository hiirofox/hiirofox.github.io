import { BaseNode } from './BaseNode.js';
import { Knob } from '../ui/Knob.js';
import { createNodeShell, createPort, createControlRow, STANDARD_KNOB_SIZE } from '../ui/UIBuilder.js';
import { NodeType } from '../types.js';

export class Sequencer extends BaseNode {
  static meta = {
    type: NodeType.SEQUENCER,
    label: 'SEQUENCER',
    shortLabel: 'SEQ',
    workletPath: 'js/modulars/processors/SequencerProcessor.js',
    wasmPath: 'wasm/sequencer.wasm', // [请添加此行]
    // 注意：默认值在 main.js 中被随机化覆盖，这里提供基础结构
    initialValues: { step0: 0, step1: 0, step2: 0, step3: 0, step4: 0, step5: 0, step6: 0, step7: 0 }
  };

  static renderUI(id, data, onChange, onContext) {
    const { root, body } = createNodeShell(id, this.meta.label, this.meta.shortLabel, 'min-w-[450px]', onContext);

    createPort(body, 'TRIG', 'input-trig', 'target', 'left', '30%');
    createPort(body, 'RST', 'input-reset', 'target', 'left', '70%');
    createPort(body, 'CV', 'output', 'source', 'right', '50%');

    const controls = createControlRow(body, "flex gap-2 pl-8 pr-8 py-2 justify-center");
    for (let i = 0; i < 8; i++) {
      new Knob(controls, {
        size: STANDARD_KNOB_SIZE,
        label: `${i + 1}`,
        value: data.values[`step${i}`] || 0,
        min: 0, max: 1000,
        onChange: (v) => onChange(id, `step${i}`, v)
      });
    }

    return root;
  }

  constructor(id, context) {
    super(id, context);
    this.worklet = null;
  }

  initialize(initialValues) {
    const paramData = {};
    for (let i = 0; i < 8; i++) {
      paramData[`step${i}`] = initialValues?.[`step${i}`] || 0;
    }

    this.worklet = new AudioWorkletNode(this.context, 'sequencer-processor', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      parameterData: paramData
    });

    this.input = this.worklet;
    this.output = this.worklet;

    for (let i = 0; i < 8; i++) {
      this.params.set(`step${i}`, this.worklet.parameters.get(`step${i}`));
    }

    const silencer = this.context.createGain();
    silencer.gain.value = 0;
    this.output.connect(silencer);
    silencer.connect(this.context.destination);
  }

  setProperty(key, value) {
    const param = this.worklet.parameters.get(key);
    if (param) {
      param.setValueAtTime(value, this.context.currentTime);
    }
  }

  destroy() {
    if (this.worklet) this.worklet.disconnect();
    super.destroy();
  }
}