class GainProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'gain', defaultValue: 0.5, minValue: 0, maxValue: 1 }
        ];
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const audioOut = output[0]; // 单声道输出
        
        // Input 0: Audio, Input 1: CV
        const audioInput = inputs[0];
        const cvInput = inputs[1];

        const audioChannel = (audioInput && audioInput.length > 0) ? audioInput[0] : null;
        const cvChannel = (cvInput && cvInput.length > 0) ? cvInput[0] : null;

        const gainParams = parameters.gain;

        // 如果没有音频输入，直接返回（静音）
        if (!audioChannel) return true;

        for (let i = 0; i < audioOut.length; i++) {
            const audio = audioChannel[i];
            const cv = cvChannel ? cvChannel[i] : 0;
            const gain = gainParams.length > 1 ? gainParams[i] : gainParams[0];

            let control = cv + gain;
            // 钳位防止反相
            if (control < 0) control = 0;

            audioOut[i] = audio * control;
        }

        return true;
    }
}

registerProcessor('gain-processor', GainProcessor);