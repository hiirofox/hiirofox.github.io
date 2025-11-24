#include "common.h"

struct ClockState {
    int counter;
    int divCounter;
    bool isHigh;
};

EXPORT ClockState* create_state() {
    ClockState* s = new ClockState();
    s->counter = 0;
    s->divCounter = 0;
    s->isHigh = false;
    return s;
}

EXPORT void process(ClockState* s, float* outTrig, float* outDiv, int length, float sampleRate, float bpm) {
    // 脉宽: 10ms
    int pulseWidthSamples = (int)(0.01f * sampleRate);
    
    // 每拍采样数 (16分音符)
    // Formula: sampleRate / (bpm / 60) / 4
    float samplesPerBeat = sampleRate / (bpm / 60.0f) / 4.0f;
    
    for (int i = 0; i < length; i++) {
        s->counter++;
        
        if (s->counter >= (int)samplesPerBeat) {
            s->counter = 0;
            s->isHigh = true;
            s->divCounter++;
            if (s->divCounter >= 8) {
                s->divCounter = 0;
            }
        }
        
        if (s->counter > pulseWidthSamples) {
            s->isHigh = false;
        }
        
        outTrig[i] = s->isHigh ? 1.0f : 0.0f;
        if (outDiv) {
            outDiv[i] = (s->divCounter == 0 && s->isHigh) ? 1.0f : 0.0f;
        }
    }
}