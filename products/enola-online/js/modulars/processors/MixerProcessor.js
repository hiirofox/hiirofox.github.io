class MixerProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'gain0', defaultValue: 1, minValue: 0, maxValue: 2 },
            { name: 'gain1', defaultValue: 1, minValue: 0, maxValue: 2 },
            { name: 'gain2', defaultValue: 1, minValue: 0, maxValue: 2 },
            { name: 'gain3', defaultValue: 1, minValue: 0, maxValue: 2 }
        ];
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const outChannel = output[0];
        
        // Mixer 有 4 个输入
        // inputs[0] ~ inputs[3]
        
        for (let i = 0; i < outChannel.length; i++) {
            let sum = 0;

            for (let ch = 0; ch < 4; ch++) {
                const input = inputs[ch];
                // 检查输入通道是否有数据
                const channelData = (input && input.length > 0) ? input[0] : null;
                const sample = channelData ? channelData[i] : 0;

                // 获取对应通道的 Gain 参数
                const gainParams = parameters[`gain${ch}`];
                const gain = gainParams.length > 1 ? gainParams[i] : gainParams[0];

                sum += sample * gain;
            }
            
            outChannel[i] = sum;
        }

        return true;
    }
}

registerProcessor('mixer-processor', MixerProcessor);