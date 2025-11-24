
#include "common.h"

struct LfoState {
    float phase;
    float lastReset;
    int type; 
};

EXPORT LfoState* create_state() {
    LfoState* s = new LfoState();
    s->phase = 0.0f;
    s->lastReset = 0.0f;
    s->type = 2; // Default Sine
    return s;
}

EXPORT void set_type(LfoState* s, int type) {
    if (s) s->type = type;
}

EXPORT void process(LfoState* s, float* outSig, float* outPhase, float* rateIn, float* resetIn, int length, float sampleRate, float freqParam, float gainParam) {
    float g = gainParam / 1000.0f;

    for (int i = 0; i < length; i++) {
        float rMod = rateIn ? rateIn[i] : 0.0f;
        float reset = resetIn ? resetIn[i] : 0.0f;

        if (reset > 0.5f && s->lastReset <= 0.5f) {
            s->phase = 0.0f;
        }
        s->lastReset = reset;

        float currentFreq = (freqParam * freqParam / 100.0f) + (rMod * 100.0f);
        
        s->phase += currentFreq / sampleRate;
        if (s->phase >= 1.0f) s->phase -= 1.0f;
        if (s->phase < 0.0f) s->phase += 1.0f; // Handle negative freq

        float sample = 0.0f;
        switch (s->type) {
            case 0: // Sine (matched JS order map)
                sample = std::sin(s->phase * 2.0f * PI);
                break;
            case 1: // Square
                sample = (s->phase < 0.5f) ? 1.0f : -1.0f;
                break;
            case 2: // Sawtooth
                sample = 2.0f * (s->phase - 0.5f);
                break;
            case 3: // Triangle
                sample = (0.5f - std::abs(s->phase - 0.5f)) * 4.0f - 2.0f;
                break;
        }

        outSig[i] = sample * g;
        if (outPhase) outPhase[i] = s->phase;
    }
}