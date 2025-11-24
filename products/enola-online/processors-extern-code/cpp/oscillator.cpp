#include "common.h"

struct OscState {
    float masterPhase;
    float slavePhase;
    int type; // 0=Saw, 1=Sqr, 2=Sin, 3=Tri
};

EXPORT OscState* create_state() {
    OscState* s = new OscState();
    s->masterPhase = 0.0f;
    s->slavePhase = 0.0f;
    s->type = 0;
    return s;
}

EXPORT void set_type(OscState* s, int type) {
    if (s) s->type = type;
}

// 128 samples per block
EXPORT void process(OscState* s, float* out, float* freqIn, float* shiftIn, int length, float sampleRate, float pitch, float pwm, float sync) {
    float div12 = 1.0f / 12.0f;
    
    for (int i = 0; i < length; i++) {
        float fIn = freqIn ? freqIn[i] : 0.0f;
        float sIn = shiftIn ? shiftIn[i] : 0.0f;

        // 计算频率
        float baseHz = fIn * 500.0f;
        float exponent = (pitch + sIn * 24.0f) * div12;
        float offsetHz = std::pow(2.0f, exponent);
        float finalBaseFreq = baseHz + offsetHz;
        if (finalBaseFreq < 0) finalBaseFreq = 0;

        float slaveFreq = finalBaseFreq * sync;
        
        float masterStep = finalBaseFreq / sampleRate;
        float slaveStep = slaveFreq / sampleRate;

        // Master Sync Logic
        s->masterPhase += masterStep;
        if (s->masterPhase >= 1.0f) {
            s->masterPhase -= std::floor(s->masterPhase);
            s->slavePhase = 0.0f; // Hard Sync
        }

        s->slavePhase += slaveStep;
        if (s->slavePhase >= 1.0f) {
            s->slavePhase -= std::floor(s->slavePhase);
        }

        // Waveform Generation
        float sample = 0.0f;
        switch (s->type) {
            case 0: // Sawtooth
                sample = 2.0f * (s->slavePhase - 0.5f);
                break;
            case 1: // Square
                sample = (s->slavePhase < pwm) ? 1.0f : -1.0f;
                break;
            case 2: // Sine
                sample = std::sin(s->slavePhase * 2.0f * PI);
                break;
            case 3: // Triangle
                sample = 4.0f * std::abs(s->slavePhase - 0.5f) - 1.0f;
                break;
        }
        
        out[i] = sample;
    }
}