let sharedClockWasm = null;

class ClockProcessor extends AudioWorkletProcessor {
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
        if (!sharedClockWasm) {
            const result = await WebAssembly.instantiate(wasmBuffer, { env: {} });
            sharedClockWasm = result.instance.exports;
        }
        this.wasm = sharedClockWasm;

        const findFn = (name) => this.wasm[name] || this.wasm[`_${name}`];
        this.api.malloc = findFn('malloc');
        this.api.process = findFn('process');
        this.api.create_state = findFn('create_state');

        const blockSize = 128 * 4;
        this.P_TRIG = this.api.malloc(blockSize);
        this.P_DIV = this.api.malloc(blockSize);
        
        this.statePtr = this.api.create_state();
        this.ready = true;
    }

    updateMemory() {
        if (!this.float32Ram || this.float32Ram.buffer !== this.wasm.memory.buffer) {
            this.float32Ram = new Float32Array(this.wasm.memory.buffer);
        }
    }

    static get parameterDescriptors() {
        return [{ name: 'bpm', defaultValue: 120 }];
    }

    process(inputs, outputs, parameters) {
        if (!this.ready) return true;
        this.updateMemory();

        const outTrig = outputs[0][0];
        const outDiv = outputs[0][1];
        const len = outTrig.length;

        this.api.process(
            this.statePtr,
            this.P_TRIG,
            this.P_DIV,
            len,
            sampleRate,
            parameters.bpm[0]
        );

        outTrig.set(this.float32Ram.subarray(this.P_TRIG >> 2, (this.P_TRIG >> 2) + len));
        if (outDiv) outDiv.set(this.float32Ram.subarray(this.P_DIV >> 2, (this.P_DIV >> 2) + len));

        return true;
    }
}
registerProcessor('clock-processor', ClockProcessor);