// 注意: 原始 RPDFAM_SAMPLE_RATE 仅用作 setParams 中的一个比例常数
// 真正的采样率由 audioContext 传入
const RPDFAM_SAMPLE_RATE_CONST = 48000;
const MaxUnisonN = 48;

class Filter {
    constructor() { this.reset(); }
    reset() { this.tmp1 = 0.0; this.tmp2 = 0.0; this.out1 = 0.0; this.out2 = 0.0; }
    LPF1(vin, ctof, reso) { if (ctof > 0.9999) ctof = 0.9999; const fb = reso + reso / (1.0 - ctof); this.tmp1 += ctof * (vin - this.tmp1 + fb * (this.tmp1 - this.out1)); this.out1 += ctof * (this.tmp1 - this.out1); return this.out1; }
    LPF2_Oversampling_ResoLimit_limit(vin, ctof, reso, limVol = 52000.0, limK = 0.125) { ctof *= 0.5; if (ctof > 0.9999) ctof = 0.9999; const fb = reso + reso / (1.0 - ctof); for (let i = 0; i < 2; i++) { this.tmp1 += ctof * (vin - this.tmp1); this.out1 += ctof * (this.tmp1 - this.out1); this.tmp2 += ctof * (this.out1 - this.tmp2 + fb * (this.tmp2 - this.out2)); this.out2 += ctof * (this.tmp2 - this.out2); } this.out1 = this.out1 > limVol ? ((this.out1 - limVol) * limK + limVol) : this.out1; this.out1 = this.out1 < -limVol ? ((this.out1 + limVol) * limK - limVol) : this.out1; this.tmp1 = this.tmp1 > limVol ? ((this.tmp1 - limVol) * limK + limVol) : this.tmp1; this.tmp1 = this.tmp1 < -limVol ? ((this.tmp1 + limVol) * limK - limVol) : this.tmp1; this.out2 = this.out2 > limVol ? ((this.out2 - limVol) * limK + limVol) : this.out2; this.out2 = this.out2 < -limVol ? ((this.out2 + limVol) * limK - limVol) : this.out2; this.tmp2 = this.tmp2 > limVol ? ((this.tmp2 - limVol) * limK + limVol) : this.tmp2; this.tmp2 = this.tmp2 < -limVol ? ((this.tmp2 + limVol) * limK - limVol) : this.tmp2; return this.out2; }
}

class VCO {
    constructor() { this.ts1 = new Uint32Array(MaxUnisonN); this.ts2 = new Uint32Array(MaxUnisonN); this.freq1 = 0.0; this.freq2 = 0.0; }
    Saw2_Stereo_Realtime(SawFreq, UniN, delta, sampleRate) { let tmp2_l = 0, tmp2_r = 0; if (UniN > MaxUnisonN) UniN = MaxUnisonN; this.freq1 = SawFreq + this.freq1 - Math.floor(this.freq1); this.freq2 = SawFreq + this.freq2 - Math.floor(this.freq2); for (let i = 0; i < UniN; ++i) { this.freq1 += delta; this.ts1[i] += Math.floor(this.freq1); this.freq2 -= delta; this.ts2[i] += Math.floor(this.freq2); tmp2_l += (this.ts1[i] - 1357) % sampleRate; tmp2_r += (this.ts2[i] + 2048) % sampleRate; } const offset = (sampleRate >> 1); return { l: (tmp2_l + tmp2_r) / UniN - offset, r: (tmp2_l - tmp2_r) / UniN - offset }; }
}

class RPDFAM_JS {
    constructor(sampleRate) {
        this.sampleRate = sampleRate; // 存储实际的采样率
        this.t = 0.0;
        this.nowPitch = 0.0;
        this.nowVol = 0.0;
        this.nowCtof = 1.0;
        this.t_ctof = 0.0;
        this.nowFreq = 0.0;
        this.nowPos = 0;
        this.Vbpm = 0.0; this.Vdtune = 0.0; this.Vctof = 0.0;
        this.Vctofdecay = 1.0; this.Vreso = 0.0; this.Vmxfreq = 0.0; this.Vfrdecay = 1.0;
        this.internalParams = { v1_bpm: 2048, v2_dtune: 10, v3_ctof: 4095, v4_ctofdecay: 2048, v5_reso: 0, v6_mxfreq: 0, v7_frdecay: 0, seqKnobs: [2048, 2048, 2048, 2048, 2048, 2048, 2048, 2048, 2048, 2048, 2048, 2048, 2048, 2048, 2048, 2048] };
        this.adcfilt1 = new Filter(); this.adcfilt2 = new Filter(); this.adcfilt3 = new Filter(); this.adcfilt4 = new Filter(); this.adcfilt5 = new Filter(); this.adcfilt6 = new Filter(); this.adcfilt7 = new Filter();
        this.vco1 = new VCO();
        this.filt1_L = new Filter();
        this.filt1_R = new Filter(); // 右声道滤波器实例
        this.setParams(this.internalParams);
    }
    setParams(params) {
        this.internalParams = Object.assign(this.internalParams, params);
        const p = this.internalParams;
        // 使用 this.sampleRate 进行 BPM 计算
        this.Vbpm = (this.adcfilt1.LPF1(p.v1_bpm, 0.1, 0) / 4095.0) * 200.0 / this.sampleRate / 12.0;
        this.Vdtune = this.adcfilt2.LPF1(p.v2_dtune, 0.3, 0) / 4095.0 * 1.0 + 0.0005;
        const tmp_Vctof = this.adcfilt3.LPF1(p.v3_ctof, 0.3, 0) / 4095.0 * 4.0; this.Vctof = tmp_Vctof * tmp_Vctof;
        this.Vctofdecay = 1.0 - Math.pow(this.adcfilt4.LPF1(p.v4_ctofdecay, 0.3, 0) / 4095.0, 3.0) * 0.002;
        const tmp_Vreso = this.adcfilt5.LPF1(p.v5_reso, 0.3, 0) / 4095.0; this.Vreso = Math.sqrt(tmp_Vreso);
        this.Vmxfreq = this.adcfilt6.LPF1(p.v6_mxfreq, 0.3, 0) / 4095.0 * 2000.0;
        this.Vfrdecay = 1.0 - Math.pow(this.adcfilt7.LPF1(p.v7_frdecay, 0.3, 0) / 4095.0, 3.0) * 0.002;
        this.updateSequencerKnobs();
    }
    updateSequencerKnobs() { const currentPitchKnob = this.internalParams.seqKnobs[this.nowPos]; const currentVolKnob = this.internalParams.seqKnobs[this.nowPos + 8]; let p = currentPitchKnob / 4095.0; this.nowPitch = p * p * p * p * 700.0; let v = currentVolKnob / 4095.0; this.nowVol = v * v; this.t_ctof = this.nowVol * this.Vctof; this.t_ctof = this.t_ctof > 1.75 ? 1.75 : this.t_ctof; }

    ProcessBlock(outl, outr, numSamples) {
        const NORM_32BIT = 1.0 / 2147483647.0;
        for (let i = 0; i < numSamples; ++i) {
            const sign = this.vco1.Saw2_Stereo_Realtime(this.nowPitch + this.nowFreq, 3, this.Vdtune * 2.0, this.sampleRate);

            // 左声道使用左滤波器
            const datL = this.filt1_L.LPF2_Oversampling_ResoLimit_limit(sign.l, this.t_ctof * this.nowCtof, this.Vreso);

            // !! 修正: 右声道必须使用右滤波器 (filt1_R)
            const datR = this.filt1_R.LPF2_Oversampling_ResoLimit_limit(sign.r, this.t_ctof * this.nowCtof, this.Vreso);

            this.nowCtof *= this.Vctofdecay;
            this.nowFreq *= this.Vfrdecay;
            const outL_gain = datL * 10000.0;
            const outR_gain = datR * 10000.0;
            outl[i] = outL_gain * NORM_32BIT * 2.0;
            outr[i] = outR_gain * NORM_32BIT * 2.0; // 现在 outl 和 outr 将是不同的
            this.t += this.Vbpm;
            if (this.t >= 1.0) { this.nowCtof = 1.0; this.nowFreq = this.Vmxfreq; this.nowPos = (this.nowPos + 1) % 8; this.updateSequencerKnobs(); this.t -= 1.0; }
        }
    }
}

// 导出主类，以便 main.js 可以导入它
export { RPDFAM_JS };