class LFOProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.type = 'sine';
        this.phase = 0;
        this.lastReset = 0;

        this.port.onmessage = (e) => {
            if (e.data.type === 'config') {
                this.type = e.data.payload.type;
            }
        };
    }

    static get parameterDescriptors() {
        return [
            { name: 'frequency', defaultValue: 5, minValue: 0.1, maxValue: 100 },
            { name: 'gain', defaultValue: 100, minValue: 0, maxValue: 1000 }
        ];
    }

    process(inputs, outputs, parameters) {
        // Output 0: Contains 2 channels
        // Channel 0: Audio Signal
        // Channel 1: Phase Signal (for UI)
        const output = outputs[0];
        const outSignal = output[0];
        const outPhase = output[1];

        const rateInput = inputs[0];
        const resetInput = inputs[1];
        const rateChannel = (rateInput && rateInput.length > 0) ? rateInput[0] : null;
        const resetChannel = (resetInput && resetInput.length > 0) ? resetInput[0] : null;

        const freqParams = parameters.frequency;
        const gainParams = parameters.gain;

        const currentSampleRate = sampleRate;
        const hasPhaseOut = !!outPhase;

        for (let i = 0; i < outSignal.length; i++) {
            const rMod = rateChannel ? rateChannel[i] : 0;
            const reset = resetChannel ? resetChannel[i] : 0;

            const freq = freqParams.length > 1 ? freqParams[i] : freqParams[0];
            const gain = gainParams.length > 1 ? gainParams[i] : gainParams[0];
            const g = gain / 1000.0;

            if (reset > 0.5 && this.lastReset <= 0.5) {
                this.phase = 0;
            }
            this.lastReset = reset;

            let currentFreq = freq * freq / 100.0 + (rMod * 100.0);

            this.phase += currentFreq / currentSampleRate;
            if (this.phase >= 1.0) this.phase -= 1.0;
            if (this.phase < 0) this.phase += 1.0;

            let sample = 0;
            switch (this.type) {
                case 'sawtooth':
                    sample = 2.0 * (this.phase - 0.5);
                    break;
                case 'square':
                    sample = this.phase < 0.5 ? 1.0 : -1.0;
                    break;
                case 'sine':
                    sample = Math.sin(this.phase * 2.0 * Math.PI);
                    break;
                case 'triangle':
                    sample = (0.5 - Math.abs(this.phase - 0.5)) * 4.0 - 2.0;
                    break;
            }

            outSignal[i] = sample * g;

            // 输出相位 (0.0 ~ 1.0) 用于 UI 绘制
            if (hasPhaseOut) outPhase[i] = this.phase;
        }

        return true;
    }
}

registerProcessor('lfo-processor', LFOProcessor);