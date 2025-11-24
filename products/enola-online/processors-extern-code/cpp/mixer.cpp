#include "common.h"

// Mixer 也无需状态
EXPORT void process(float* out, float* in0, float* in1, float* in2, float* in3, int length, float g0, float g1, float g2, float g3) {
    for (int i = 0; i < length; i++) {
        float sum = 0.0f;
        if (in0) sum += in0[i] * g0;
        if (in1) sum += in1[i] * g1;
        if (in2) sum += in2[i] * g2;
        if (in3) sum += in3[i] * g3;
        out[i] = sum;
    }
}