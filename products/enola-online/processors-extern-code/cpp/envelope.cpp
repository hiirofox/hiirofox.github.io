#include "common.h"

enum EnvState { IDLE = 0, ATTACK = 1, DECAY = 2 };

struct EnvData {
    int state;
    float timeAccumulator;
    float lastTrig;
    float currentValue;
};

EXPORT EnvData* create_state() {
    EnvData* s = new EnvData();
    s->state = IDLE;
    s->timeAccumulator = 0.0f;
    s->lastTrig = 0.0f;
    s->currentValue = 0.0f;
    return s;
}

EXPORT void process(EnvData* s, float* outCv, float* outPhase, float* trigIn, int length, float sampleRate, float attack, float decay) {
    float dt = 1.0f / sampleRate;

    for (int i = 0; i < length; i++) {
        float trig = trigIn ? trigIn[i] : 0.0f;
        
        // Trigger
        if (trig > 0.5f && s->lastTrig <= 0.5f) {
            s->state = ATTACK;
            s->timeAccumulator = 0.0f;
        }
        s->lastTrig = trig;

        float phaseOut = 0.0f;

        if (s->state == ATTACK) {
            s->timeAccumulator += dt;
            s->currentValue = s->timeAccumulator / attack;
            
            float totalDur = attack + decay;
            phaseOut = s->timeAccumulator / totalDur;

            if (s->timeAccumulator >= attack) {
                s->currentValue = 1.0f;
                s->state = DECAY;
                s->timeAccumulator = 0.0f;
            }
        } 
        else if (s->state == DECAY) {
            s->timeAccumulator += dt;
            float linearProgress = 1.0f - (s->timeAccumulator / decay);
            s->currentValue = std::pow(std::max(0.0f, linearProgress), 3.0f);

            float totalDur = attack + decay;
            phaseOut = (attack + s->timeAccumulator) / totalDur;

            if (s->timeAccumulator >= decay) {
                s->currentValue = 0.0f;
                s->state = IDLE;
                phaseOut = 0.0f;
            }
        } else {
            s->currentValue = 0.0f;
            phaseOut = 0.0f;
        }

        s->currentValue = clamp(s->currentValue, 0.0f, 1.0f);
        
        outCv[i] = s->currentValue;
        if (outPhase) outPhase[i] = phaseOut;
    }
}