// 导入我们需要的类
import { RPDFAM_JS } from './rpdfam-dsp.js';
import { LMKnob } from './lm-knob.js';

const startButton = document.getElementById('startButton');
// 新增: 获取随机化按钮
const randomButton = document.getElementById('randomButton');

let audioContext;
let scriptNode; 
let allKnobs = {}; 
let activeKnob = null;

// 全局拖动处理
window.onKnobDragStart = (knobInstance, clientY) => {
    activeKnob = knobInstance;
    activeKnob.setDragStart(clientY);
    document.body.style.cursor = 'ns-resize';
};
document.onmousemove = (e) => { if (activeKnob) { activeKnob.handleDrag(e.clientY); } };
document.onmouseup = (e) => { activeKnob = null; document.body.style.cursor = 'default'; };

// DSP 参数映射
const paramMap = {
    "bpm": "v1_bpm", "detune": "v2_dtune", "ctof": "v3_ctof",
    "ctofdecay": "v4_ctofdecay", "reso": "v5_reso", "famount": "v6_mxfreq",
    "fdecay": "v7_frdecay",
    "seqf1": "seqKnobs.0", "seqf2": "seqKnobs.1", "seqf3": "seqKnobs.2", "seqf4": "seqKnobs.3",
    "seqf5": "seqKnobs.4", "seqf6": "seqKnobs.5", "seqf7": "seqKnobs.6", "seqf8": "seqKnobs.7",
    "seqv1": "seqKnobs.8", "seqv2": "seqKnobs.9", "seqv3": "seqKnobs.10", "seqv4": "seqKnobs.11",
    "seqv5": "seqKnobs.12", "seqv6": "seqKnobs.13", "seqv7": "seqKnobs.14", "seqv8": "seqKnobs.15"
};

// 启动按钮逻辑
startButton.onclick = async () => {
    if (audioContext) {
        if (audioContext.state === 'running') {
            await audioContext.suspend();
            startButton.textContent = 'Start Audio';
        } else if (audioContext.state === 'suspended') {
            await audioContext.resume();
            startButton.textContent = 'Stop Audio';
        }
        return;
    }
    
    try {
        console.log("Starting Audio Context...");
        const RPDFAM_TARGET_RATE = 48000;
        audioContext = new AudioContext({ sampleRate: RPDFAM_TARGET_RATE }); 
        
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log("Audio Context Resumed.");
        }
        
        if (audioContext.sampleRate !== RPDFAM_TARGET_RATE) {
             console.warn(`Warning: Browser forced sample rate to ${audioContext.sampleRate}. Requested ${RPDFAM_TARGET_RATE}.`);
        }

        const bufferSize = 1024;
        scriptNode = audioContext.createScriptProcessor(bufferSize, 0, 2);
        
        scriptNode.synth = new RPDFAM_JS(audioContext.sampleRate);
        
        scriptNode.onaudioprocess = function(audioProcessingEvent) {
            const outl = audioProcessingEvent.outputBuffer.getChannelData(0);
            const outr = audioProcessingEvent.outputBuffer.getChannelData(1);
            const numSamples = outl.length;
            this.synth.ProcessBlock(outl, outr, numSamples);
        };
        
        scriptNode.connect(audioContext.destination);
        
        console.log("ScriptProcessorNode Connected with DSP.");
        startButton.textContent = 'Stop Audio';
    
    } catch (e) {
        console.error("Error starting audio:", e);
        startButton.textContent = 'Error - Try Again';
        if (audioContext) {
            await audioContext.close();
            audioContext = null;
        }
        return;
    }

    // 更新参数的回调函数
    const sendParamUpdate = (id, value) => {
        if (scriptNode && scriptNode.synth) {
            const key = paramMap[id];
            if (key) {
                const params = scriptNode.synth.internalParams; 
                if (key.includes('.')) {
                    const [objKey, index] = key.split('.');
                    params[objKey][parseInt(index)] = value;
                } else {
                    params[key] = value;
                }
                scriptNode.synth.setParams(params); 
            }
        }
    };
    
    // 定义所有旋钮及其标签
    const initialParams = {
        "bpm": { value: 2048, label: "BPM" }, 
        "detune": { value: 10, label: "Detune" }, 
        "ctof": { value: 4095, label: "Ctof" }, 
        "ctofdecay": { value: 2048, label: "CtofDecay" }, 
        "reso": { value: 0, label: "Reso" }, 
        "famount": { value: 0, label: "FAmount" }, 
        "fdecay": { value: 0, label: "FDecay" },
        "seqf1": { value: 2048, label: "SeqF1" }, "seqf2": { value: 2048, label: "SeqF2" }, 
        "seqf3": { value: 2048, label: "SeqF3" }, "seqf4": { value: 2048, label: "SeqF4" }, 
        "seqf5": { value: 2048, label: "SeqF5" }, "seqf6": { value: 2048, label: "SeqF6" }, 
        "seqf7": { value: 2048, label: "SeqF7" }, "seqf8": { value: 2048, label: "SeqF8" },
        "seqv1": { value: 2048, label: "SeqV1" }, "seqv2": { value: 2048, label: "SeqV2" }, 
        "seqv3": { value: 2048, label: "SeqV3" }, "seqv4": { value: 2048, label: "SeqV4" }, 
        "seqv5": { value: 2048, label: "SeqV5" }, "seqv6": { value: 2048, label: "SeqV6" }, 
        "seqv7": { value: 2048, label: "SeqV7" }, "seqv8": { value: 2048, label: "SeqV8" }
    };

    // 实例化所有旋钮
    for (const [id, config] of Object.entries(initialParams)) {
         allKnobs[id] = new LMKnob(
            document.getElementById(`knob-${id}`), 
            id, 
            { 
                value: config.value, 
                label: config.label, 
                onchange: sendParamUpdate 
            }
        );
         allKnobs[id].setValue(config.value, true); 
    }
};

// --- 新增: 随机化按钮逻辑 ---
const excludeFromRandom = ['bpm', 'ctof']; // 不随机化的参数

randomButton.onclick = () => {
    // 检查合成器是否已初始化
    if (!scriptNode || !scriptNode.synth) {
        console.log("Audio not started. Cannot randomize.");
        return;
    }

    const params = scriptNode.synth.internalParams;
    
    // 1. 在内部参数对象上生成随机值
    for (const [id, knob] of Object.entries(allKnobs)) {
        // 跳过排除列表中的参数
        if (excludeFromRandom.includes(id)) {
            continue; 
        }

        const key = paramMap[id];
        // 生成 0 到 4095 之间的随机整数
        const randomValue = Math.floor(Math.random() * 4096); 

        if (key.includes('.')) {
            const [objKey, index] = key.split('.');
            params[objKey][parseInt(index)] = randomValue;
        } else {
            params[key] = randomValue;
        }
    }

    // 2. 将所有更改一次性应用到 DSP
    scriptNode.synth.setParams(params);

    // 3. 更新所有旋钮的 UI 以匹配新状态
    for (const [id, knob] of Object.entries(allKnobs)) {
        if (excludeFromRandom.includes(id)) {
            continue;
        }
        
        const key = paramMap[id];
        let newValue;
        if (key.includes('.')) {
            const [objKey, index] = key.split('.');
            newValue = params[objKey][parseInt(index)];
        } else {
            newValue = params[key];
        }
        // 更新 UI, 'false' 表示不要再次触发 sendParamUpdate
        knob.setValue(newValue, false); 
    }
};