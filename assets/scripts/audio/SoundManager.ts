/**
 * FC 风格 8-bit 音频引擎
 * 用 WebAudio 实时合成：方波/三角波/噪声，不依赖任何音频文件。
 * 浏览器使用 window.AudioContext，微信小游戏使用 wx.createWebAudioContext。
 */

type Wave = 'square' | 'triangle' | 'noise';

interface SFXDef {
    wave: Wave;
    /** 频率包络步骤 [freq, 持续时间(秒)] */
    notes: [number, number][];
    vol?: number;
}

/** 音符：midi 音高，0 表示休止 */
interface BgmNote { m: number; d: number; }
interface BgmDef {
    tempo: number;
    wave: Wave;
    vol?: number;
    melody: BgmNote[];
    bass?: BgmNote[];
}

/* midi -> 频率 */
function m2f(m: number): number {
    if (m <= 0) return 0;
    return 440 * Math.pow(2, (m - 69) / 12);
}

/* ===== 音效表 ===== */
const SFX: Record<string, SFXDef> = {
    cursor: { wave: 'square', vol: 0.08, notes: [[880, 0.05]] },
    confirm: { wave: 'square', vol: 0.1, notes: [[660, 0.06], [990, 0.08]] },
    cancel: { wave: 'square', vol: 0.1, notes: [[440, 0.06], [220, 0.08]] },
    hit: { wave: 'noise', vol: 0.18, notes: [[0, 0.05], [0, 0.05]] },
    hurt: { wave: 'square', vol: 0.12, notes: [[220, 0.09], [140, 0.12]] },
    magic: { wave: 'triangle', vol: 0.14, notes: [[523, 0.06], [784, 0.06], [1046, 0.14]] },
    heal: { wave: 'triangle', vol: 0.14, notes: [[659, 0.08], [880, 0.08], [1046, 0.14]] },
    levelup: { wave: 'square', vol: 0.1, notes: [[523, 0.07], [659, 0.07], [784, 0.07], [1046, 0.2]] },
    encounter: { wave: 'square', vol: 0.14, notes: [[880, 0.12], [660, 0.12], [440, 0.14], [330, 0.2]] },
    victory: { wave: 'square', vol: 0.12, notes: [[523, 0.09], [659, 0.09], [784, 0.09], [1046, 0.12], [1318, 0.28]] },
    flee: { wave: 'square', vol: 0.1, notes: [[660, 0.08], [440, 0.08], [330, 0.12]] },
    step: { wave: 'noise', vol: 0.03, notes: [[0, 0.03]] },
};

/* ===== 原创 BGM（8 小节循环小品，模仿 FC 芯片曲风）===== */
const C = 60, D = 62, Eb = 63, E = 64, F = 65, G = 67, A = 57, Bb = 58, B = 59;
// 注意：旋律为原创，非任何既有乐曲

const BGM: Record<string, BgmDef> = {
    title: {
        tempo: 96, wave: 'square', vol: 0.07,
        melody: [
            { m: A, d: 1.5 }, { m: 0, d: 0.5 }, { m: C, d: 1.5 }, { m: 0, d: 0.5 },
            { m: E, d: 2 }, { m: D, d: 1 }, { m: B, d: 1.5 }, { m: 0, d: 0.5 },
            { m: A, d: 1.5 }, { m: 0, d: 0.5 }, { m: G, d: 2 }, { m: E, d: 2 }, { m: 0, d: 1 },
        ],
        bass: [
            { m: A - 24, d: 4 }, { m: F - 24, d: 4 }, { m: G - 24, d: 4 }, { m: B - 24, d: 2 }, { m: E - 24, d: 2 },
        ],
    },
    field: {
        tempo: 120, wave: 'square', vol: 0.06,
        melody: [
            { m: E, d: 1 }, { m: G, d: 1 }, { m: A, d: 1 }, { m: G, d: 1 },
            { m: E, d: 1 }, { m: C, d: 1 }, { m: D, d: 2 },
            { m: E, d: 1 }, { m: G, d: 1 }, { m: A, d: 1 }, { m: C + 12, d: 1 },
            { m: A, d: 1 }, { m: G, d: 2 }, { m: E, d: 1 }, { m: 0, d: 1 },
        ],
        bass: [
            { m: A - 24, d: 2 }, { m: E - 24, d: 2 }, { m: F - 24, d: 2 }, { m: G - 24, d: 2 },
            { m: A - 24, d: 2 }, { m: C - 24, d: 2 }, { m: D - 24, d: 2 }, { m: E - 24, d: 2 },
        ],
    },
    church: {
        tempo: 72, wave: 'triangle', vol: 0.1,
        melody: [
            { m: E, d: 2 }, { m: G, d: 2 }, { m: A, d: 3 }, { m: G, d: 1 },
            { m: E, d: 2 }, { m: D, d: 2 }, { m: E, d: 4 },
            { m: B, d: 2 }, { m: A, d: 2 }, { m: G, d: 3 }, { m: E, d: 1 },
            { m: A, d: 2 }, { m: G, d: 2 }, { m: E, d: 4 }, { m: 0, d: 2 },
        ],
        bass: [
            { m: A - 24, d: 4 }, { m: F - 24, d: 4 }, { m: E - 24, d: 4 }, { m: B - 24, d: 4 },
        ],
    },
    battle: {
        tempo: 150, wave: 'square', vol: 0.07,
        melody: [
            { m: A, d: 0.5 }, { m: A, d: 0.5 }, { m: 0, d: 0.5 }, { m: A, d: 0.5 },
            { m: G, d: 0.5 }, { m: F, d: 0.5 }, { m: E, d: 1 },
            { m: F, d: 0.5 }, { m: F, d: 0.5 }, { m: 0, d: 0.5 }, { m: F, d: 0.5 },
            { m: E, d: 0.5 }, { m: D, d: 0.5 }, { m: E, d: 1 },
            { m: A, d: 0.5 }, { m: C + 12, d: 0.5 }, { m: A, d: 0.5 }, { m: E, d: 0.5 },
            { m: D, d: 1 }, { m: E, d: 1 }, { m: 0, d: 0.5 },
        ],
        bass: [
            { m: A - 24, d: 1 }, { m: A - 24, d: 1 }, { m: F - 24, d: 1 }, { m: F - 24, d: 1 },
            { m: E - 24, d: 1 }, { m: D - 24, d: 1 }, { m: E - 24, d: 2 },
        ],
    },
    boss: {
        tempo: 160, wave: 'square', vol: 0.08,
        melody: [
            { m: E, d: 1 }, { m: F, d: 1 }, { m: G, d: 1 }, { m: B, d: 1 },
            { m: A, d: 1 }, { m: G, d: 1 }, { m: F, d: 2 },
            { m: E, d: 1 }, { m: F, d: 1 }, { m: G, d: 1 }, { m: B, d: 1 },
            { m: C + 12, d: 1 }, { m: B, d: 1 }, { m: A, d: 2 }, { m: 0, d: 1 },
        ],
        bass: [
            { m: E - 24, d: 2 }, { m: E - 24, d: 2 }, { m: F - 24, d: 2 }, { m: G - 24, d: 2 },
            { m: E - 24, d: 2 }, { m: E - 24, d: 2 }, { m: D - 24, d: 2 }, { m: B - 24, d: 2 },
        ],
    },
    ending: {
        tempo: 84, wave: 'triangle', vol: 0.1,
        melody: [
            { m: A, d: 2 }, { m: C, d: 2 }, { m: E, d: 4 },
            { m: G, d: 2 }, { m: F, d: 2 }, { m: E, d: 3 }, { m: D, d: 1 },
            { m: E, d: 6 }, { m: 0, d: 2 },
        ],
        bass: [
            { m: A - 24, d: 6 }, { m: F - 24, d: 6 }, { m: E - 24, d: 6 }, { m: A - 24, d: 6 },
        ],
    },
};

class SoundManager {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private bgmTimer: ReturnType<typeof setInterval> | null = null;
    private bgmStep = 0;
    private curBgm: BgmDef | null = null;
    public enabled = true;

    public init(): void {
        if (this.ctx) return;
        try {
            const g: any = globalThis as any;
            if (g.wx && g.wx.createWebAudioContext) {
                // 微信小游戏环境
                this.ctx = g.wx.createWebAudioContext() as AudioContext;
            } else if (g.AudioContext) {
                this.ctx = new g.AudioContext();
            } else if (g.webkitAudioContext) {
                this.ctx = new g.webkitAudioContext();
            }
            if (this.ctx) {
                this.master = this.ctx.createGain();
                this.master.gain.value = 0.9;
                this.master.connect(this.ctx.destination);
            }
        } catch (_e) {
            this.ctx = null;
        }
    }

    public resume(): void {
        try {
            if (this.ctx && (this.ctx as any).state === 'suspended') {
                (this.ctx as any).resume();
            }
        } catch (_e) { /* ignore */ }
    }

    private note(wave: Wave, freq: number, dur: number, vol: number, when: number): void {
        if (!this.ctx || !this.master || freq <= 0 || !this.enabled) return;
        const t = this.ctx.currentTime + when;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.008);
        g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.02));
        g.gain.linearRampToValueAtTime(0, t + dur);
        g.connect(this.master);
        if (wave === 'noise') {
            const len = Math.floor(this.ctx.sampleRate * dur);
            const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            src.connect(g);
            src.start(t);
        } else {
            const osc = this.ctx.createOscillator();
            osc.type = wave;
            osc.frequency.setValueAtTime(freq, t);
            osc.connect(g);
            osc.start(t);
            osc.stop(t + dur);
        }
    }

    public play(name: string): void {
        const def = SFX[name];
        if (!def || !this.ctx || !this.enabled) return;
        this.resume();
        let at = 0;
        const vol = def.vol ?? 0.08;
        for (const [f, d] of def.notes) {
            this.note(def.wave, f, d, vol, at);
            at += d;
        }
    }

    /** 播放循环 BGM（序列器以半拍为节拍单位） */
    public playBgm(name: string): void {
        if (!this.ctx) return;
        this.stopBgm();
        const def = BGM[name];
        if (!def) return;
        this.curBgm = def;
        this.bgmStep = 0;
        const beat = 60 / def.tempo / 2; // 半拍秒数
        const tick = () => {
            if (!this.curBgm || !this.ctx || !this.enabled) return;
            const seqs = [this.curBgm.melody];
            if (this.curBgm.bass) seqs.push(this.curBgm.bass);
            for (const seq of seqs) {
                let at = 0;
                for (const n of seq) {
                    if (this.bgmStep === Math.round(at / beat) || Math.abs(this.bgmStep * beat - at) < 1e-6) {
                        const vol = seq === this.curBgm.melody ? (this.curBgm.vol ?? 0.06) : 0.045;
                        this.note(this.curBgm.wave, m2f(n.m), n.d * 60 / this.curBgm.tempo, vol, 0.001);
                    }
                    at += n.d * 60 / this.curBgm.tempo;
                }
            }
            const total = this.curBgm.melody.reduce((s, n) => s + n.d, 0) * 60 / this.curBgm.tempo;
            this.bgmStep = (this.bgmStep + 1) % Math.ceil(total / beat);
        };
        tick();
        this.bgmTimer = setInterval(tick, beat * 1000);
    }

    public stopBgm(): void {
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
        this.curBgm = null;
    }
}

export const Sound = new SoundManager();