class EnvelopeProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.STATE = { IDLE: 0, ATTACK: 1, DECAY: 2 };
        this.currentState = 0; 
        this.timeAccumulator = 0;
        this.lastTrig = 0;
        this.currentValue = 0;
    }

    static get parameterDescriptors() {
        // [修改點] 將最大值從 2.0 改為 1.0，提高調節精度
        return [
            { name: 'attack', defaultValue: 0.01, minValue: 0.00001, maxValue: 0.1 },
            { name: 'decay', defaultValue: 0.05, minValue: 0.00001, maxValue: 4.0 }
        ];
    }

    process(inputs, outputs, parameters) {
        const outputCV = outputs[0][0];
        const outputPhase = outputs[0][1]; 
        
        const inputTrig = inputs[0][0];
        
        const attackParams = parameters.attack;
        const decayParams = parameters.decay;
        
        const currentSampleRate = sampleRate;
        const dt = 1 / currentSampleRate;
        const hasPhaseOut = !!outputPhase;

        for (let i = 0; i < outputCV.length; i++) {
            const trig = inputTrig ? inputTrig[i] : 0;
            const attack = attackParams.length > 1 ? attackParams[i] : attackParams[0];
            const decay = decayParams.length > 1 ? decayParams[i] : decayParams[0];

            // Trigger Logic
            if (trig > 0.5 && this.lastTrig <= 0.5) {
                this.currentState = this.STATE.ATTACK;
                this.timeAccumulator = 0;
            }
            this.lastTrig = trig;

            let phaseOutput = 0; 

            if (this.currentState === this.STATE.ATTACK) {
                this.timeAccumulator += dt;
                // Linear Attack
                this.currentValue = this.timeAccumulator / attack;
                
                const totalDur = attack + decay;
                phaseOutput = (this.timeAccumulator) / totalDur;

                if (this.timeAccumulator >= attack) {
                    this.currentValue = 1.0;
                    this.currentState = this.STATE.DECAY;
                    this.timeAccumulator = 0; 
                }
            } 
            else if (this.currentState === this.STATE.DECAY) {
                this.timeAccumulator += dt;
                
                // Exponential Decay (3rd power)
                const linearProgress = 1.0 - (this.timeAccumulator / decay);
                this.currentValue = Math.pow(Math.max(0, linearProgress), 3.0);
                
                const totalDur = attack + decay;
                phaseOutput = (attack + this.timeAccumulator) / totalDur;

                if (this.timeAccumulator >= decay) {
                    this.currentValue = 0.0;
                    this.currentState = this.STATE.IDLE;
                    phaseOutput = 0;
                }
            } else {
                this.currentValue = 0.0;
                phaseOutput = 0;
            }

            this.currentValue = Math.max(0, Math.min(1, this.currentValue));
            
            outputCV[i] = this.currentValue;
            if (hasPhaseOut) outputPhase[i] = phaseOutput;
        }

        return true;
    }
}

registerProcessor('envelope-processor', EnvelopeProcessor);