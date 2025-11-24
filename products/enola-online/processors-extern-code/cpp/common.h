#ifndef COMMON_H
#define COMMON_H

#include <cmath>
#include <algorithm>

#define PI 3.14159265358979323846f

// 防止 C++ 名称修饰，供 JS 调用
#define EXPORT extern "C" __attribute__((used))

// 简单的钳位函数
inline float clamp(float v, float min, float max) {
    return (v < min) ? min : (v > max) ? max : v;
}

#endif