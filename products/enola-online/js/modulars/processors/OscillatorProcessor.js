// [优化] 模块级变量，所有 Oscillator 共享同一个 WASM 实例
let sharedOscWasm = null;

class OscillatorProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.type = 'sawtooth';
        this.typeMap = { 'sawtooth': 0, 'square': 1, 'sine': 2, 'triangle': 3 };
        
        this.wasm = null;
        this.float32Ram = null;
        this.statePtr = 0;
        this.ready = false;
        
        this.P_OUT = 0;
        this.P_FREQ = 0;
        this.P_SHIFT = 0;
        
        this.api = { malloc: null, process: null, create_state: null, set_type: null };

        this.port.onmessage = (e) => {
            if (e.data.type === 'config') {
                this.type = e.data.payload.type;
                if (this.ready) this.api.set_type(this.statePtr, this.typeMap[this.type] || 0);
            } else if (e.data.type === 'load-wasm') {
                this.init(e.data.payload.wasmBuffer);
            }
        };
    }

    async init(wasmBuffer) {
        try {
            // [核心优化] 如果已经有实例，直接复用
            if (!sharedOscWasm) {
                const result = await WebAssembly.instantiate(wasmBuffer, { env: {} });
                sharedOscWasm = result.instance.exports;
            }
            this.wasm = sharedOscWasm;

            const findFn = (name) => this.wasm[name] || this.wasm[`_${name}`];
            this.api.malloc = findFn('malloc');
            this.api.process = findFn('process');
            this.api.create_state = findFn('create_state');
            this.api.set_type = findFn('set_type');

            const blockSize = 128 * 4;
            this.P_OUT = this.api.malloc(blockSize);
            this.P_FREQ = this.api.malloc(blockSize);
            this.P_SHIFT = this.api.malloc(blockSize);
            this.statePtr = this.api.create_state();
            
            this.api.set_type(this.statePtr, this.typeMap[this.type] || 0);
            this.ready = true;
        } catch (e) {
            console.error("OSC Init Error:", e);
        }
    }

    updateMemory() {
        if (!this.float32Ram || this.float32Ram.buffer !== this.wasm.memory.buffer) {
            this.float32Ram = new Float32Array(this.wasm.memory.buffer);
        }
    }

    static get parameterDescriptors() {
        return [
            { name: 'pitch', defaultValue: 0, minValue: -127, maxValue: 200 },
            { name: 'pwm', defaultValue: 0.5, minValue: 0.1, maxValue: 0.9 },
            { name: 'sync', defaultValue: 1.0, minValue: 0.1, maxValue: 10.0 }
        ];
    }

    process(inputs, outputs, parameters) {
        if (!this.ready) return true;
        this.updateMemory();

        const outCh = outputs[0][0];
        const freqCh = inputs[0][0];
        const shiftCh = inputs[1][0];
        const len = outCh.length;

        if (freqCh) this.float32Ram.set(freqCh, this.P_FREQ >> 2);
        else this.float32Ram.fill(0, this.P_FREQ >> 2, (this.P_FREQ >> 2) + len);

        if (shiftCh) this.float32Ram.set(shiftCh, this.P_SHIFT >> 2);
        else this.float32Ram.fill(0, this.P_SHIFT >> 2, (this.P_SHIFT >> 2) + len);

        const p = parameters;
        this.api.process(
            this.statePtr,
            this.P_OUT,
            this.P_FREQ,
            this.P_SHIFT,
            len,
            sampleRate,
            p.pitch.length > 1 ? p.pitch[0] : p.pitch[0],
            p.pwm[0],
            p.sync[0]
        );

        outCh.set(this.float32Ram.subarray(this.P_OUT >> 2, (this.P_OUT >> 2) + len));
        return true;
    }
}
registerProcessor('oscillator-processor', OscillatorProcessor);