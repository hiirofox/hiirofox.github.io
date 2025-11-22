class OscillatorProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.type = 'sawtooth';
        this.masterPhase = 0;
        this.slavePhase = 0;
        this.DIV12 = 1.0 / 12.0;

        this.port.onmessage = (e) => {
            if (e.data.type === 'config') {
                if (e.data.payload.type) this.type = e.data.payload.type;
            }
        };
    }

    static get parameterDescriptors() {
        return [
            { name: 'pitch', defaultValue: 40, minValue: 0, maxValue: 127 },
            { name: 'pwm', defaultValue: 0.5, minValue: 0.1, maxValue: 0.9 },
            { name: 'sync', defaultValue: 1.0, minValue: 0.1, maxValue: 10.0 }
        ];
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0]; 
        
        // inputs[0] -> FREQ, inputs[1] -> SHIFT
        const freqInput = inputs[0];
        const shiftInput = inputs[1];
        
        // 检查输入是否已连接且有数据
        const freqChannel = (freqInput && freqInput.length > 0) ? freqInput[0] : null;
        const shiftChannel = (shiftInput && shiftInput.length > 0) ? shiftInput[0] : null;

        const pitchParams = parameters.pitch;
        const pwmParams = parameters.pwm;
        const syncParams = parameters.sync;

        // 【修正点】：直接使用全局变量 sampleRate
        // 在 AudioWorkletGlobalScope 中，sampleRate 是全局可见的，不能通过 this.context 访问
        const currentSampleRate = sampleRate; 

        for (let i = 0; i < channel.length; i++) {
            const inF = freqChannel ? freqChannel[i] : 0;
            const inS = shiftChannel ? shiftChannel[i] : 0;

            // 处理 AudioParam (长度可能是 1 或 128)
            const pitch = pitchParams.length > 1 ? pitchParams[i] : pitchParams[0];
            const pwm = pwmParams.length > 1 ? pwmParams[i] : pwmParams[0];
            const sync = syncParams.length > 1 ? syncParams[i] : syncParams[0];

            const baseHz = inF * 500.0;
            const exponent = (pitch + inS * 24.0) * this.DIV12;
            const offsetHz = Math.pow(2, exponent);
            const finalBaseFreq = Math.max(0, baseHz + offsetHz);

            const slaveFreq = finalBaseFreq * sync;

            const masterStep = finalBaseFreq / currentSampleRate;
            const slaveStep = slaveFreq / currentSampleRate;

            this.masterPhase += masterStep;
            if (this.masterPhase >= 1.0) {
                this.masterPhase -= 1.0;
                this.slavePhase = 0;
            }

            this.slavePhase += slaveStep;
            if (this.slavePhase >= 1.0) this.slavePhase -= 1.0;

            let sample = 0;
            switch (this.type) {
                case 'sawtooth':
                    sample = 2.0 * (this.slavePhase - 0.5);
                    break;
                case 'square':
                    sample = this.slavePhase < pwm ? 1.0 : -1.0;
                    break;
                case 'sine':
                    sample = Math.sin(this.slavePhase * 2.0 * Math.PI);
                    break;
                case 'triangle':
                    sample = 4.0 * Math.abs(this.slavePhase - 0.5) - 1.0;
                    break;
            }
            
            channel[i] = sample;
        }

        return true;
    }
}

registerProcessor('oscillator-processor', OscillatorProcessor);