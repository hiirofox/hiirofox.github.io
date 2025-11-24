let sharedMixerWasm = null;

class MixerProcessor extends AudioWorkletProcessor {
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
        if (!sharedMixerWasm) {
            const result = await WebAssembly.instantiate(wasmBuffer, { env: {} });
            sharedMixerWasm = result.instance.exports;
        }
        this.wasm = sharedMixerWasm;

        const findFn = (name) => this.wasm[name] || this.wasm[`_${name}`];
        this.api.malloc = findFn('malloc');
        this.api.process = findFn('process');

        const blockSize = 128 * 4;
        this.P_OUT = this.api.malloc(blockSize);
        this.P_IN0 = this.api.malloc(blockSize);
        this.P_IN1 = this.api.malloc(blockSize);
        this.P_IN2 = this.api.malloc(blockSize);
        this.P_IN3 = this.api.malloc(blockSize);
        
        this.ready = true;
    }

    updateMemory() {
        if (!this.float32Ram || this.float32Ram.buffer !== this.wasm.memory.buffer) {
            this.float32Ram = new Float32Array(this.wasm.memory.buffer);
        }
    }

    static get parameterDescriptors() {
        return [
            { name: 'gain0', defaultValue: 1 }, { name: 'gain1', defaultValue: 1 },
            { name: 'gain2', defaultValue: 1 }, { name: 'gain3', defaultValue: 1 }
        ];
    }

    process(inputs, outputs, parameters) {
        if (!this.ready) return true;
        this.updateMemory();

        const out = outputs[0][0];
        const len = out.length;
        
        const copyInput = (idx, ptr) => {
            const ch = (inputs[idx] && inputs[idx].length > 0) ? inputs[idx][0] : null;
            if (ch) this.float32Ram.set(ch, ptr >> 2);
            else this.float32Ram.fill(0, ptr >> 2, (ptr >> 2) + len);
            return ch ? ptr : 0; 
        };

        const p0 = copyInput(0, this.P_IN0);
        const p1 = copyInput(1, this.P_IN1);
        const p2 = copyInput(2, this.P_IN2);
        const p3 = copyInput(3, this.P_IN3);

        this.api.process(
            this.P_OUT,
            p0, p1, p2, p3,
            len,
            parameters.gain0[0], parameters.gain1[0],
            parameters.gain2[0], parameters.gain3[0]
        );

        out.set(this.float32Ram.subarray(this.P_OUT >> 2, (this.P_OUT >> 2) + len));
        return true;
    }
}
registerProcessor('mixer-processor', MixerProcessor);