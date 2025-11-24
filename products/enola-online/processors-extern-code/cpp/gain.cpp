#include "common.h"

// Gain 无需复杂状态，直接处理
EXPORT void process(float* out, float* audioIn, float* cvIn, int length, float gainParam) {
    if (!audioIn) return; // Silent if no input

    for (int i = 0; i < length; i++) {
        float cv = cvIn ? cvIn[i] : 0.0f;
        float control = cv + gainParam;
        if (control < 0.0f) control = 0.0f;
        
        out[i] = audioIn[i] * control;
    }
}