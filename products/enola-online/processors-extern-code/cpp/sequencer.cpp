#include "common.h"

struct SeqState {
    int currentStep;
    float lastTrig;
    float lastReset;
};

EXPORT SeqState* create_state() {
    SeqState* s = new SeqState();
    s->currentStep = 0;
    s->lastTrig = 0.0f;
    s->lastReset = 0.0f;
    return s;
}

// steps 是一个包含8个float的数组指针
EXPORT void process(SeqState* s, float* outCv, float* trigIn, float* resetIn, float* steps, int length) {
    for (int i = 0; i < length; i++) {
        float t = trigIn ? trigIn[i] : 0.0f;
        float r = resetIn ? resetIn[i] : 0.0f;

        if (r > 0.5f && s->lastReset <= 0.5f) {
            s->currentStep = 0;
        }

        if (t > 0.5f && s->lastTrig <= 0.5f) {
            s->currentStep++;
            if (s->currentStep >= 8) s->currentStep = 0;
        }

        s->lastTrig = t;
        s->lastReset = r;

        // 输出 CV
        outCv[i] = steps[s->currentStep] / 1000.0f;
    }
}