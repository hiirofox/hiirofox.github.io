let sharedSeqWasm = null;

class SequencerProcessor extends AudioWorkletProcessor {
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
        if (!sharedSeqWasm) {
            const result = await WebAssembly.instantiate(wasmBuffer, { env: {} });
            sharedSeqWasm = result.instance.exports;
        }
        this.wasm = sharedSeqWasm;

        const findFn = (name) => this.wasm[name] || this.wasm[`_${name}`];
        this.api.malloc = findFn('malloc');
        this.api.process = findFn('process');
        this.api.create_state = findFn('create_state');

        const blockSize = 128 * 4;
        this.P_OUT = this.api.malloc(blockSize);
        this.P_TRIG = this.api.malloc(blockSize);
        this.P_RST = this.api.malloc(blockSize);
        this.P_STEPS = this.api.malloc(8 * 4); 
        
        this.statePtr = this.api.create_state();
        this.ready = true;
    }

    updateMemory() {
        if (!this.float32Ram || this.float32Ram.buffer !== this.wasm.memory.buffer) {
            this.float32Ram = new Float32Array(this.wasm.memory.buffer);
        }
    }

    static get parameterDescriptors() {
        const params = [];
        for(let i=0; i<8; i++) params.push({ name: `step${i}`, defaultValue: 0 });
        return params;
    }

    process(inputs, outputs, parameters) {
        if (!this.ready) return true;
        this.updateMemory();

        const outCv = outputs[0][0];
        const trigIn = inputs[0][0];
        const rstIn = inputs[1][0];
        const len = outCv.length;

        if (trigIn) this.float32Ram.set(trigIn, this.P_TRIG >> 2);
        else this.float32Ram.fill(0, this.P_TRIG >> 2, (this.P_TRIG >> 2) + len);

        if (rstIn) this.float32Ram.set(rstIn, this.P_RST >> 2);
        else this.float32Ram.fill(0, this.P_RST >> 2, (this.P_RST >> 2) + len);

        const stepOffset = this.P_STEPS >> 2;
        for (let i = 0; i < 8; i++) {
            this.float32Ram[stepOffset + i] = parameters[`step${i}`][0];
        }

        this.api.process(
            this.statePtr,
            this.P_OUT,
            this.P_TRIG,
            this.P_RST,
            this.P_STEPS,
            len
        );

        outCv.set(this.float32Ram.subarray(this.P_OUT >> 2, (this.P_OUT >> 2) + len));
        return true;
    }
}
registerProcessor('sequencer-processor', SequencerProcessor);