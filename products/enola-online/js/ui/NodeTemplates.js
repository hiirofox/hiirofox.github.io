import { NodeType } from '../types.js';
import { Knob } from './Knob.js';
import { Switch } from './Switch.js';

// Helper to create the base shell
const createContainer = (label, typeStr, width, onContext) => {
    const div = document.createElement('div');
    div.className = `node-container bg-black ${width} select-none group z-10`;

    // Context Menu Handler
    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation(); 
        if (!div.classList.contains('selected')) {
             // Select exclusively if not already part of group
             const all = document.querySelectorAll('.node-container.selected');
             all.forEach(n => n.classList.remove('selected'));
             div.classList.add('selected');
        }
        onContext(e);
    });

    // Header
    const header = document.createElement('div');
    header.className = "bg-[#002200] border-b border-[#00FF00] h-5 flex justify-between items-center px-2 cursor-move header-drag-handle";
    header.innerHTML = `
        <span class="text-[9px] text-[#00FF00] font-bold font-arial uppercase tracking-wider pointer-events-none">${label}</span>
        <span class="text-[9px] text-[#005500] font-arial tracking-wider pointer-events-none">${typeStr}</span>
    `;

    div.appendChild(header);

    const body = document.createElement('div');
    body.className = "relative min-h-[60px] flex flex-col justify-center";
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
    [NodeType.MASTER]: (id, data, onChange, onContext) => {
        const { root, body } = createContainer('OUTPUT', 'MASTER', 'min-w-[120px]', onContext);
        body.innerHTML = `<div class="flex justify-center items-center h-10 bg-[#050505] border-y border-[#111] my-1"><span class="text-[#00FF00] text-[9px] font-arial">STEREO OUT</span></div>`;
        createPort(body, 'IN', 'input', 'target', 'left', '50%');
        return root;
    },

    [NodeType.OSCILLATOR]: (id, data, onChange, onContext) => {
        const { root, body } = createContainer('OSCILLATOR', 'VCO', 'min-w-[160px]', onContext);

        createPort(body, 'FREQ', 'input-freq', 'target', 'left', '30%');
        createPort(body, 'SHIFT', 'input-shift', 'target', 'left', '70%');
        createPort(body, 'OUT', 'output', 'source', 'right', '50%');

        const controls = document.createElement('div');
        controls.className = "flex items-center pl-10 pr-10 py-2 gap-3";

        new Switch(controls, {
            value: data.values.type || 'sawtooth',
            options: [
                { label: 'SAW', value: 'sawtooth' },
                { label: 'SQR', value: 'square' },
                { label: 'SIN', value: 'sine' },
                { label: 'TRI', value: 'triangle' }
            ],
            onChange: (v) => onChange(id, 'type', v)
        });

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
        createPort(body, 'CTOF', 'param-frequency', 'target', 'left', '75%');
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

    [NodeType.LFO]: (id, data, onChange, onContext) => {
        const { root, body } = createContainer('LFO', 'MOD', 'min-w-[160px]', onContext);
        createPort(body, 'RATE', 'input-rate', 'target', 'left', '25%');
        createPort(body, 'RST', 'input-reset', 'target', 'left', '75%');
        createPort(body, 'CV', 'output', 'source', 'right', '50%');

        const controls = document.createElement('div');
        controls.className = "flex items-center pl-10 pr-10 py-2 gap-3";

        new Switch(controls, {
            value: data.values.type || 'sine',
            options: [{ label: 'SIN', value: 'sine' }, { label: 'SQR', value: 'square' }, { label: 'SAW', value: 'sawtooth' }],
            onChange: (v) => onChange(id, 'type', v)
        });

        const knobs = document.createElement('div');
        knobs.className = "flex gap-2";
        new Knob(knobs, { size: STANDARD_KNOB_SIZE, label: 'RATE', value: data.values.frequency || 5, min: 0.1, max: 50, onChange: (v) => onChange(id, 'frequency', v) });
        new Knob(knobs, { size: STANDARD_KNOB_SIZE, label: 'DPTH', value: data.values.gain || 100, min: 0, max: 1000, onChange: (v) => onChange(id, 'gain', v) });
        controls.appendChild(knobs);
        body.appendChild(controls);
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
    }
};