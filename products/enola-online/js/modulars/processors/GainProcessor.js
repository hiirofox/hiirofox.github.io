let sharedGainWasm = null;

class GainProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.wasm = null;
        this.float32Ram = null;
        this.ready = false;
        this.api = { malloc: null, process: null };

        this.port.onmessage = (e) => {
            if (e.data.type === 'load-wasm') this.init(e.data.payload.wasmBuffer);
        };
    }

    async init(wasmBuffer) {
        if (!sharedGainWasm) {
            const result = await WebAssembly.instantiate(wasmBuffer, { env: {} });
            sharedGainWasm = result.instance.exports;
        }
        this.wasm = sharedGainWasm;

        const findFn = (name) => this.wasm[name] || this.wasm[`_${name}`];
        this.api.malloc = findFn('malloc');
        this.api.process = findFn('process');

        const blockSize = 128 * 4;
        this.P_OUT = this.api.malloc(blockSize);
        this.P_IN = this.api.malloc(blockSize);
        this.P_CV = this.api.malloc(blockSize);
        
        this.ready = true;
    }

    updateMemory() {
        if (!this.float32Ram || this.float32Ram.buffer !== this.wasm.memory.buffer) {
            this.float32Ram = new Float32Array(this.wasm.memory.buffer);
        }
    }

    static get parameterDescriptors() {
        return [{ name: 'gain', defaultValue: 0.5, minValue: 0, maxValue: 1 }];
    }

    process(inputs, outputs, parameters) {
        if (!this.ready) return true;
        this.updateMemory();

        const outCh = outputs[0][0];
        const inCh = inputs[0][0];
        if (!inCh) return true; 

        const cvCh = inputs[1][0];
        const len = outCh.length;

        this.float32Ram.set(inCh, this.P_IN >> 2);
        
        if (cvCh) this.float32Ram.set(cvCh, this.P_CV >> 2);
        else this.float32Ram.fill(0, this.P_CV >> 2, (this.P_CV >> 2) + len);

        this.api.process(
            this.P_OUT,
            this.P_IN,
            this.P_CV,
            len,
            parameters.gain[0]
        );

        outCh.set(this.float32Ram.subarray(this.P_OUT >> 2, (this.P_OUT >> 2) + len));
        return true;
    }
}
registerProcessor('gain-processor', GainProcessor);