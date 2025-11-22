class SequencerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.currentStep = 0;
        this.lastTrig = 0;
        this.lastReset = 0;
    }

    static get parameterDescriptors() {
        const params = [];
        for(let i=0; i<8; i++) {
            params.push({ name: `step${i}`, defaultValue: 0, minValue: 0, maxValue: 1000 });
        }
        return params;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const cvOut = output[0];

        // Input 0: Trig, Input 1: Reset
        const trigInput = inputs[0];
        const resetInput = inputs[1];

        const trigChannel = (trigInput && trigInput.length > 0) ? trigInput[0] : null;
        const resetChannel = (resetInput && resetInput.length > 0) ? resetInput[0] : null;

        // 缓存 step 参数数组引用
        const stepParams = [];
        for(let i=0; i<8; i++) stepParams[i] = parameters[`step${i}`];

        for (let i = 0; i < cvOut.length; i++) {
            const t = trigChannel ? trigChannel[i] : 0;
            const r = resetChannel ? resetChannel[i] : 0;

            if (r > 0.5 && this.lastReset <= 0.5) {
                this.currentStep = 0;
            }

            if (t > 0.5 && this.lastTrig <= 0.5) {
                this.currentStep++;
                if (this.currentStep >= 8) {
                    this.currentStep = 0;
                }
            }

            this.lastTrig = t;
            this.lastReset = r;

            // 获取当前 step 的值
            const p = stepParams[this.currentStep];
            const val = p.length > 1 ? p[i] : p[0];
            
            cvOut[i] = val / 1000.0;
        }

        return true;
    }
}

registerProcessor('sequencer-processor', SequencerProcessor);