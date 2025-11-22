import { BaseNode } from './BaseNode.js';

export class Envelope extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.worklet = null;
    this.analyser = null; 
    this.animationFrameId = null;
    
    // UI 绘图用的缓存变量
    this.currentAttack = 0.1;
    this.currentDecay = 0.5;
    this.currentGain = 1.0; // [变量名更改] currentAmount -> currentGain
  }

  initialize(initialValues) {
    this.currentAttack = initialValues?.attack || 0.1;
    this.currentDecay = initialValues?.decay || 0.5;
    // [参数更改] 获取 initialValues.gain
    this.currentGain = initialValues?.gain !== undefined ? initialValues.gain : 1.0;

    // 1. 创建 Worklet
    this.worklet = new AudioWorkletNode(this.context, 'envelope-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2], // Ch0: CV, Ch1: Phase
        parameterData: {
            attack: this.currentAttack,
            decay: this.currentDecay
        }
    });

    // 2. 信号路由
    const splitter = this.context.createChannelSplitter(2);
    this.worklet.connect(splitter);
    
    // Output CV (Channel 0) -> Gain Node -> Output
    this.output = this.context.createGain(); 
    this.output.gain.value = this.currentGain; // 应用初始 Gain

    splitter.connect(this.output, 0, 0);

    // UI Phase (Channel 1)
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 128; 
    splitter.connect(this.analyser, 1, 0);

    this.input = this.worklet;

    this.startVisualizer();
  }

  startVisualizer() {
    const update = () => {
        const container = document.getElementById(this.id);
        if (!container) return; 
        
        const canvas = container.querySelector('canvas');
        if (canvas) {
            this.draw(canvas);
        }
        
        this.animationFrameId = requestAnimationFrame(update);
    };
    this.animationFrameId = requestAnimationFrame(update);
  }

  draw(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    const buffer = new Float32Array(1);
    this.analyser.getFloatTimeDomainData(buffer);
    const phase = buffer[0]; 

    ctx.clearRect(0, 0, w, h);

    // 自动缩放逻辑
    const total = this.currentAttack + this.currentDecay;
    const safeTotal = total < 0.001 ? 0.001 : total;
    const attackRatio = this.currentAttack / safeTotal;
    const peakX = w * attackRatio;

    ctx.beginPath();
    ctx.strokeStyle = '#00FFFF'; 
    ctx.lineWidth = 2;
    
    // Attack
    ctx.moveTo(0, h); 
    ctx.lineTo(peakX, 1); 
    
    // Decay
    if (w > peakX) {
        for (let x = Math.floor(peakX); x <= w; x++) {
            const progress = (x - peakX) / (w - peakX);
            const clampedProgress = Math.max(0, Math.min(1, progress));
            const linearVal = 1.0 - clampedProgress;
            const yVal = Math.pow(linearVal, 3.0);
            const plotY = h - (yVal * h);
            ctx.lineTo(x, plotY);
        }
    } else {
        ctx.lineTo(w, h);
    }
    
    ctx.stroke();

    // 指示线
    if (phase > 0.001 && phase < 0.999) {
        const lineX = phase * w;
        ctx.beginPath();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]); 
        ctx.moveTo(lineX, 0);
        ctx.lineTo(lineX, h);
        ctx.stroke();
        ctx.setLineDash([]); 
    }
  }

  setProperty(key, value) {
    if (key === 'attack') {
        this.currentAttack = value;
        const param = this.worklet.parameters.get('attack');
        if (param) param.setValueAtTime(value, this.context.currentTime);
    }
    
    if (key === 'decay') {
        this.currentDecay = value;
        const param = this.worklet.parameters.get('decay');
        if (param) param.setValueAtTime(value, this.context.currentTime);
    }

    // [参数更改] 处理 gain
    if (key === 'gain') {
        this.currentGain = value;
        this.output.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
    }
  }

  destroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.worklet) this.worklet.disconnect();
    super.destroy();
  }
}