import { NodeType } from '../types.js';
import { Knob } from './Knob.js';
import { Switch } from './Switch.js';

// Helper to create the base shell
const createContainer = (label, typeStr, width, onContext) => {
    const div = document.createElement('div');
    div.className = `node-container bg-black ${width} select-none group z-10`;

    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!div.classList.contains('selected')) {
            const all = document.querySelectorAll('.node-container.selected');
            all.forEach(n => n.classList.remove('selected'));
            div.classList.add('selected');
        }
        onContext(e);
    });

    const header = document.createElement('div');
    header.className = "bg-[#002200] border-b border-[#00FF00] h-5 flex justify-between items-center px-2 cursor-move header-drag-handle";
    header.innerHTML = `
        <span class="text-[9px] text-[#00FF00] font-bold font-arial uppercase tracking-wider pointer-events-none">${label}</span>
        <span class="text-[9px] text-[#005500] font-arial tracking-wider pointer-events-none">${typeStr}</span>
    `;

    div.appendChild(header);

    const body = document.createElement('div');
    // [修改] 统一最小高度，确保视觉一致性
    body.className = "relative min-h-[62px] flex flex-col justify-center";
    div.appendChild(body);

    return { root: div, body: body };
};

// Helper for Ports
const createPort = (parent, label, handleId, type, side, topPercent) => {
    const isLeft = side === 'left';
    const wrapper = document.createElement('div');
    wrapper.className = `absolute flex items-center ${isLeft ? '-left-[5px]' : '-right-[5px]'}`;
    wrapper.style.top = topPercent;
    wrapper.style.flexDirection = isLeft ? 'row' : 'row-reverse';
    wrapper.style.transform = 'translateY(-50%)';
    wrapper.style.whiteSpace = 'nowrap';
    wrapper.style.zIndex = '50';

    const portDiv = document.createElement('div');
    portDiv.className = "port relative z-50";
    portDiv.dataset.handleid = handleId;
    portDiv.dataset.type = type;

    const text = document.createElement('span');
    text.className = `text-[9px] text-[#00FF00] font-arial uppercase leading-none ${isLeft ? 'ml-1 text-left' : 'mr-1 text-right'}`;
    text.style.paddingTop = '1px';
    text.innerText = label;

    wrapper.appendChild(portDiv);
    wrapper.appendChild(text);
    parent.appendChild(wrapper);
};

const STANDARD_KNOB_SIZE = 36;

export const NodeRenderers = {
    // --- [修改] Master ---
    [NodeType.MASTER]: (id, data, onChange, onContext) => {
        const { root, body } = createContainer('OUTPUT', 'MASTER', 'min-w-[120px]', onContext);
        // 使用 py-2 和 h-[46px] 确保与 VCA 高度一致
        const container = document.createElement('div');
        container.className = "flex justify-center items-center py-2 px-4 w-full";
        container.innerHTML = `<div class="flex justify-center items-center w-full h-[46px] bg-[#050505] border-y border-[#111]"><span class="text-[#00FF00] text-[9px] font-arial">STEREO OUT</span></div>`;

        body.appendChild(container);
        createPort(body, 'IN', 'input', 'target', 'left', '50%');
        return root;
    },

    // --- [修改] Oscillator ---
    [NodeType.OSCILLATOR]: (id, data, onChange, onContext) => {
        const { root, body } = createContainer('OSCILLATOR', 'VCO', 'min-w-[160px]', onContext);

        createPort(body, 'FREQ', 'input-freq', 'target', 'left', '30%');
        createPort(body, 'SHIFT', 'input-shift', 'target', 'left', '70%');
        createPort(body, 'OUT', 'output', 'source', 'right', '50%');

        const controls = document.createElement('div');
        controls.className = "flex items-center pl-10 pr-10 py-2 gap-3";

        // [微调] Switch 使用更紧凑的 gap 以防止高度溢出
        const switchContainer = document.createElement('div');
        switchContainer.className = "flex flex-col gap-[2px]"; // 紧凑模式
        new Switch(switchContainer, {
            value: data.values.type || 'sawtooth',
            options: [
                { label: 'SAW', value: 'sawtooth' },
                { label: 'SQR', value: 'square' },
                { label: 'SIN', value: 'sine' },
                { label: 'TRI', value: 'triangle' }
            ],
            onChange: (v) => onChange(id, 'type', v)
        });
        controls.appendChild(switchContainer);

        const knobs = document.createElement('div');
        knobs.className = "flex gap-2";
        new Knob(knobs, { size: STANDARD_KNOB_SIZE, label: 'PITCH', value: data.values.pitch || 40, min: 30, max: 180, onChange: (v) => onChange(id, 'pitch', v) });
        new Knob(knobs, { size: STANDARD_KNOB_SIZE, label: 'SYNC', value: data.values.sync || 1.0, min: 0.1, max: 10.0, onChange: (v) => onChange(id, 'sync', v) });
        new Knob(knobs, { size: STANDARD_KNOB_SIZE, label: 'PWM', value: data.values.pwm || 0.5, min: 0.1, max: 0.9, onChange: (v) => onChange(id, 'pwm', v) });
        controls.appendChild(knobs);

        body.appendChild(controls);
        return root;
    },

    [NodeType.FILTER]: (id, data, onChange, onContext) => {
        const { root, body } = createContainer('FILTER', 'VCF', 'min-w-[160px]', onContext);

        createPort(body, 'IN', 'input', 'target', 'left', '25%');
        createPort(body, 'CTOF', 'input-cv', 'target', 'left', '75%');
        createPort(body, 'OUT', 'output', 'source', 'right', '50%');

        const controls = document.createElement('div');
        controls.className = "flex items-center pl-10 pr-10 py-2 gap-3";

        new Switch(controls, {
            value: data.values.type || 'lowpass',
            options: [{ label: 'LPF', value: 'lowpass' }, { label: 'HPF', value: 'highpass' }, { label: 'BPF', value: 'bandpass' }],
            onChange: (v) => onChange(id, 'type', v)
        });

        const knobs = document.createElement('div');
        knobs.className = "flex gap-2";
        new Knob(knobs, { size: STANDARD_KNOB_SIZE, label: 'CUT', value: data.values.frequency || 1000, min: 10, max: 24000, onChange: (v) => onChange(id, 'frequency', v) });
        new Knob(knobs, { size: STANDARD_KNOB_SIZE, label: 'RES', value: data.values.q || 1, min: 0, max: 20, onChange: (v) => onChange(id, 'q', v) });
        controls.appendChild(knobs);

        body.appendChild(controls);
        return root;
    },

    // VCA (标准高度参考)
    [NodeType.GAIN]: (id, data, onChange, onContext) => {
        const { root, body } = createContainer('AMPLIFIER', 'VCA', 'min-w-[120px]', onContext);
        createPort(body, 'IN', 'input', 'target', 'left', '25%');
        createPort(body, 'CV', 'input-cv', 'target', 'left', '75%');
        createPort(body, 'OUT', 'output', 'source', 'right', '50%');

        const controls = document.createElement('div');
        controls.className = "flex justify-center pl-8 pr-8 py-2";
        new Knob(controls, { size: STANDARD_KNOB_SIZE, label: 'AMT', value: data.values.gain !== undefined ? data.values.gain : 0.5, min: 0, max: 1, onChange: (v) => onChange(id, 'gain', v) });
        body.appendChild(controls);
        return root;
    },

    // --- [修改] LFO ---
    [NodeType.LFO]: (id, data, onChange, onContext) => {
        const { root, body } = createContainer('LFO', 'MOD', 'min-w-[320px]', onContext);
        createPort(body, 'RATE', 'input-rate', 'target', 'left', '25%');
        createPort(body, 'RST', 'input-reset', 'target', 'left', '75%');
        createPort(body, 'CV', 'output', 'source', 'right', '50%');

        const content = document.createElement('div');
        content.className = "flex flex-row items-center w-full p-2 gap-4 pl-8 pr-8 justify-between";

        // 1. 左侧：Canvas
        // [修改点] 高度统一为 46px (46 + 16 = 62px)
        const canvasContainer = document.createElement('div');
        canvasContainer.className = "h-[46px] flex-grow bg-black border border-[#005500] relative";
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 46;
        canvas.className = "w-full h-full";
        canvasContainer.appendChild(canvas);

        // 2. 右侧：控件
        const controls = document.createElement('div');
        controls.className = "flex flex-row gap-4 items-center";

        new Switch(controls, {
            value: data.values.type || 'sine',
            options: [{ label: 'SIN', value: 'sine' }, { label: 'SQR', value: 'square' }, { label: 'SAW', value: 'sawtooth' }],
            onChange: (v) => onChange(id, 'type', v)
        });

        new Knob(controls, { size: STANDARD_KNOB_SIZE, label: 'RATE', value: data.values.frequency || 5, min: 0.1, max: 50, onChange: (v) => onChange(id, 'frequency', v) });
        new Knob(controls, { size: STANDARD_KNOB_SIZE, label: 'DPTH', value: data.values.gain || 100, min: 0, max: 1000, onChange: (v) => onChange(id, 'gain', v) });

        content.appendChild(canvasContainer);
        content.appendChild(controls);

        body.appendChild(content);
        return root;
    },

    [NodeType.CLOCK]: (id, data, onChange, onContext) => {
        const { root, body } = createContainer('CLOCK', 'CLK', 'min-w-[120px]', onContext);
        createPort(body, 'TRIG', 'output-trig', 'source', 'right', '30%');
        createPort(body, '/ 8', 'output-div', 'source', 'right', '70%');

        const controls = document.createElement('div');
        controls.className = "flex justify-center pr-8 py-2";
        new Knob(controls, { size: STANDARD_KNOB_SIZE, label: 'BPM', value: data.values.bpm || 120, min: 40, max: 240, onChange: (v) => onChange(id, 'bpm', v) });
        body.appendChild(controls);
        return root;
    },

    [NodeType.SEQUENCER]: (id, data, onChange, onContext) => {
        const { root, body } = createContainer('SEQUENCER', 'SEQ', 'min-w-[450px]', onContext);
        createPort(body, 'TRIG', 'input-trig', 'target', 'left', '30%');
        createPort(body, 'RST', 'input-reset', 'target', 'left', '70%');
        createPort(body, 'CV', 'output', 'source', 'right', '50%');

        const controls = document.createElement('div');
        controls.className = "flex gap-2 pl-8 pr-8 py-2 justify-center";
        for (let i = 0; i < 8; i++) {
            new Knob(controls, {
                size: STANDARD_KNOB_SIZE,
                label: `${i + 1}`,
                value: data.values[`step${i}`] || 0,
                min: 0, max: 1000,
                onChange: (v) => onChange(id, `step${i}`, v)
            });
        }
        body.appendChild(controls);
        return root;
    },

    // --- [修改] A/D Envelope ---
    [NodeType.ENVELOPE]: (id, data, onChange, onContext) => {
        const { root, body } = createContainer('A/D ENVELOPE', 'ENV', 'min-w-[280px]', onContext);

        createPort(body, 'TRIG', 'input', 'target', 'left', '30%');
        createPort(body, 'CV', 'output', 'source', 'right', '50%');

        const content = document.createElement('div');
        content.className = "flex flex-row items-center w-full p-2 gap-4 pl-9 pr-8 justify-between";

        // [修改点] 高度统一为 46px
        const canvasContainer = document.createElement('div');
        canvasContainer.className = "h-[46px] flex-grow bg-black border border-[#005500] relative";
        const canvas = document.createElement('canvas');
        canvas.width = 140;
        canvas.height = 46;
        canvas.className = "w-full h-full";
        canvasContainer.appendChild(canvas);

        const knobs = document.createElement('div');
        knobs.className = "flex flex-row gap-2";

        new Knob(knobs, {
            size: 36,
            label: 'ATK',
            value: data.values.attack || 0.1,
            min: 0.001, max: 1.0,
            onChange: (v) => onChange(id, 'attack', v)
        });

        new Knob(knobs, {
            size: 36,
            label: 'DEC',
            value: data.values.decay || 0.5,
            min: 0.001, max: 1.0,
            onChange: (v) => onChange(id, 'decay', v)
        });

        new Knob(knobs, {
            size: 36,
            label: 'GAIN',
            value: data.values.gain !== undefined ? data.values.gain : 1.0,
            min: 0, max: 4,
            onChange: (v) => onChange(id, 'gain', v)
        });

        content.appendChild(canvasContainer);
        content.appendChild(knobs);

        body.appendChild(content);
        return root;
    },
    [NodeType.MIXER]: (id, data, onChange, onContext) => {
        // 宽度 240px 足够容纳 4 个横向旋钮
        const { root, body } = createContainer('MIXER', 'MIX', 'min-w-[240px]', onContext);

        // 4 个输入端口，垂直分布在左侧 (20%, 40%, 60%, 80%)
        createPort(body, '1', 'input-0', 'target', 'left', '20%');
        createPort(body, '2', 'input-1', 'target', 'left', '40%');
        createPort(body, '3', 'input-2', 'target', 'left', '60%');
        createPort(body, '4', 'input-3', 'target', 'left', '80%');

        // 1 个输出端口
        createPort(body, 'OUT', 'output', 'source', 'right', '50%');

        // 旋钮容器：水平排列 (flex-row)
        const content = document.createElement('div');
        // pl-8 为左侧密集的端口标签留空间
        content.className = "flex flex-row items-center justify-center w-full p-2 gap-2 pl-2 pr-4";

        for (let i = 0; i < 4; i++) {
            new Knob(content, {
                size: 36,
                label: `CH${i + 1}`,
                value: data.values[`gain${i}`] !== undefined ? data.values[`gain${i}`] : 1.0,
                min: 0, max: 2,
                onChange: (v) => onChange(id, `gain${i}`, v)
            });
        }

        body.appendChild(content);
        return root;
    }
};