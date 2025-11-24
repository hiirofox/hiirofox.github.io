let sharedEnvWasm = null;

class EnvelopeProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.wasm = null;
        this.float32Ram = null;
        this.statePtr = 0;
        this.ready = false;
        this.api = { malloc: null, process: null, create_state: null };

        this.port.onmessage = (e) => {
            if (e.data.type === 'load-wasm') this.init(e.data.payload.wasmBuffer);
        };
    }

    async init(wasmBuffer) {
        if (!sharedEnvWasm) {
            const result = await WebAssembly.instantiate(wasmBuffer, { env: {} });
            sharedEnvWasm = result.instance.exports;
        }
        this.wasm = sharedEnvWasm;

        const findFn = (name) => this.wasm[name] || this.wasm[`_${name}`];
        this.api.malloc = findFn('malloc');
        this.api.process = findFn('process');
        this.api.create_state = findFn('create_state');

        const blockSize = 128 * 4;
        this.P_CV = this.api.malloc(blockSize);
        this.P_PHS = this.api.malloc(blockSize);
        this.P_TRIG = this.api.malloc(blockSize);

        this.statePtr = this.api.create_state();
        this.ready = true;
    }

    updateMemory() {
        if (!this.float32Ram || this.float32Ram.buffer !== this.wasm.memory.buffer) {
            this.float32Ram = new Float32Array(this.wasm.memory.buffer);
        }
    }

    static get parameterDescriptors() {
        return [
            { name: 'attack', defaultValue: 0.1, minValue: 0.001 },
            { name: 'decay', defaultValue: 0.5, minValue: 0.001 }
        ];
    }

    process(inputs, outputs, parameters) {
        if (!this.ready) return true;
        this.updateMemory();

        const outCv = outputs[0][0];
        const outPhs = outputs[0][1];
        const trigIn = inputs[0][0];
        const len = outCv.length;

        if (trigIn) this.float32Ram.set(trigIn, this.P_TRIG >> 2);
        else this.float32Ram.fill(0, this.P_TRIG >> 2, (this.P_TRIG >> 2) + len);

        this.api.process(
            this.statePtr,
            this.P_CV,
            this.P_PHS,
            this.P_TRIG,
            len,
            sampleRate,
            parameters.attack[0],
            parameters.decay[0]
        );

        outCv.set(this.float32Ram.subarray(this.P_CV >> 2, (this.P_CV >> 2) + len));
        if (outPhs) outPhs.set(this.float32Ram.subarray(this.P_PHS >> 2, (this.P_PHS >> 2) + len));

        return true;
    }
}
registerProcessor('envelope-processor', EnvelopeProcessor);