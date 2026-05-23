// js/ModuleRegistry.js
import { NodeType } from './types.js';

// 导入所有 DSP 模块
import { Master } from './modulars/Master.js';
import { Oscillator } from './modulars/Oscillator.js';
import { Filter } from './modulars/Filter.js';
import { Gain } from './modulars/Gain.js';
import { LFO } from './modulars/LFO.js';
import { Clock } from './modulars/Clock.js';
import { Sequencer } from './modulars/Sequencer.js';
import { Envelope } from './modulars/Envelope.js';
import { Mixer } from './modulars/Mixer.js';

// 导入宏功能模块
import { Knob } from './modulars/Knob.js';
import { Macro } from './modulars/Macro.js';
import { PortIn } from './modulars/PortIn.js';
import { PortOut } from './modulars/PortOut.js';

const registry = new Map();

function register(moduleClass) {
    if (!moduleClass.meta || !moduleClass.meta.type) {
        console.warn(`Module ${moduleClass.name} missing meta configuration.`);
        return;
    }
    registry.set(moduleClass.meta.type, moduleClass);
}

// 注册所有模块
register(Master);
register(Oscillator);
register(Filter);
register(Gain);
register(LFO);
register(Clock);
register(Sequencer);
register(Envelope);
register(Mixer);

// 注册宏功能模块
register(Knob);
register(Macro);
register(PortIn);
register(PortOut);

export const ModuleRegistry = {
    getClass: (type) => registry.get(type),
    
    getRenderer: (type) => {
        const cls = registry.get(type);
        return cls ? cls.renderUI.bind(cls) : null;
    },

    getAllWorklets: () => {
        const paths = new Set();
        registry.forEach(cls => {
            if (cls.meta.workletPath) paths.add(cls.meta.workletPath);
        });
        return Array.from(paths);
    },

    getInitialValues: (type) => {
        const cls = registry.get(type);
        return cls?.meta.initialValues || {};
    }
};