class ClockProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.counter = 0;
        this.divCounter = 0;
        this.isHigh = false;
        this.samplesPerBeat = 0;
    }

    static get parameterDescriptors() {
        return [
            { name: 'bpm', defaultValue: 120, minValue: 40, maxValue: 300 }
        ];
    }

    process(inputs, outputs, parameters) {
        // Output 0: 包含两个声道 (ch0: Trig, ch1: Div)
        const output = outputs[0];
        const outTrig = output[0];
        const outDiv = output[1];

        const bpmParams = parameters.bpm;
        const currentSampleRate = sampleRate;

        // 简单的脉宽逻辑
        const pulseWidthSamples = Math.floor(0.01 * currentSampleRate);

        for (let i = 0; i < outTrig.length; i++) {
            const bpm = bpmParams.length > 1 ? bpmParams[i] : bpmParams[0];

            // 计算每拍采样数 (16分音符)
            // (60 / bpm) * sampleRate * 0.5 / 16  <-- 沿用之前的逻辑
            // 简化为: (sampleRate * 1.875) / bpm
            this.samplesPerBeat = sampleRate / (bpm / 60.0) / 4;

            this.counter++;

            if (this.counter >= this.samplesPerBeat) {
                this.counter = 0;
                this.isHigh = true;
                this.divCounter++;
                if (this.divCounter >= 8) {
                    this.divCounter = 0;
                }
            }

            if (this.counter > pulseWidthSamples) {
                this.isHigh = false;
            }

            const signal = this.isHigh ? 1.0 : 0.0;

            outTrig[i] = signal;
            // 如果只有单声道设备，outDiv 可能未定义，需检查
            if (outDiv) {
                outDiv[i] = (this.divCounter === 0 && this.isHigh) ? 1.0 : 0.0;
            }
        }

        return true;
    }
}

registerProcessor('clock-processor', ClockProcessor);