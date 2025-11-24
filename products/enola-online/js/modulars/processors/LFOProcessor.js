let sharedLfoWasm = null;

class LFOProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.type = 'sine';
        this.typeMap = { 'sine': 0, 'square': 1, 'sawtooth': 2, 'triangle': 3 };
        
        this.wasm = null;
        this.float32Ram = null;
        this.statePtr = 0;
        this.ready = false;
        
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
            if (!sharedLfoWasm) {
                const result = await WebAssembly.instantiate(wasmBuffer, { env: {} });
                sharedLfoWasm = result.instance.exports;
            }
            this.wasm = sharedLfoWasm;

            const findFn = (name) => this.wasm[name] || this.wasm[`_${name}`];
            this.api.malloc = findFn('malloc');
            this.api.process = findFn('process');
            this.api.create_state = findFn('create_state');
            this.api.set_type = findFn('set_type');

            const blockSize = 128 * 4;
            this.P_OUT_SIG = this.api.malloc(blockSize);
            this.P_OUT_PHS = this.api.malloc(blockSize);
            this.P_RATE = this.api.malloc(blockSize);
            this.P_RST = this.api.malloc(blockSize);

            this.statePtr = this.api.create_state();
            this.api.set_type(this.statePtr, this.typeMap[this.type] || 0);
            this.ready = true;
        } catch (e) {
            console.error("LFO Init Error:", e);
        }
    }

    updateMemory() {
        if (!this.float32Ram || this.float32Ram.buffer !== this.wasm.memory.buffer) {
            this.float32Ram = new Float32Array(this.wasm.memory.buffer);
        }
    }

    static get parameterDescriptors() {
        return [
            { name: 'frequency', defaultValue: 5, minValue: 0.1, maxValue: 100 },
            { name: 'gain', defaultValue: 100, minValue: 0, maxValue: 1000 }
        ];
    }

    process(inputs, outputs, parameters) {
        if (!this.ready) return true;
        this.updateMemory();

        const outSig = outputs[0][0];
        const outPhs = outputs[0][1];
        const rateIn = inputs[0][0];
        const rstIn = inputs[1][0];
        const len = outSig.length;

        if (rateIn) this.float32Ram.set(rateIn, this.P_RATE >> 2);
        else this.float32Ram.fill(0, this.P_RATE >> 2, (this.P_RATE >> 2) + len);

        if (rstIn) this.float32Ram.set(rstIn, this.P_RST >> 2);
        else this.float32Ram.fill(0, this.P_RST >> 2, (this.P_RST >> 2) + len);

        this.api.process(
            this.statePtr,
            this.P_OUT_SIG,
            this.P_OUT_PHS,
            this.P_RATE,
            this.P_RST,
            len,
            sampleRate,
            parameters.frequency[0],
            parameters.gain[0]
        );

        outSig.set(this.float32Ram.subarray(this.P_OUT_SIG >> 2, (this.P_OUT_SIG >> 2) + len));
        if (outPhs) outPhs.set(this.float32Ram.subarray(this.P_OUT_PHS >> 2, (this.P_OUT_PHS >> 2) + len));

        return true;
    }
}
registerProcessor('lfo-processor', LFOProcessor);