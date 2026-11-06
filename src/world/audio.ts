/**
 * Every sound is synthesised: desert wind, a tanpura drone (Karplus-Strong strings with a
 * buzzing bridge), footsteps on sand and stone, chisels in the carvers' yard, dawn birds,
 * night crickets and the crackle of the last fire. Nothing is downloaded.
 */
export class Sound {
  ctx: AudioContext | null = null;
  master!: GainNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private droneGain!: GainNode;
  private noise!: AudioBuffer;
  private strings: AudioBuffer[] = [];
  private enabled = false;
  private nextPluck = 0;
  private pluckIdx = 0;
  private nextChisel = 0;
  private nextCrackle = 0;
  private nextBird = 0;
  private nextCricket = 0;
  private droneLevel = 0.5;
  private tDay = 0;

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    // noise
    const len = ctx.sampleRate * 3;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }

    // wind bed
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.25;
    src.connect(this.windFilter).connect(this.windGain).connect(this.master);
    src.start();

    // drone bus with a long, soft reverb
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.0;
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.droneGain.connect(this.master);
    this.droneGain.connect(verb).connect(wet).connect(this.master);

    // tanpura strings tuned to C#: Pa, Sa', Sa', Sa
    const sa = 138.59;
    this.strings = [sa * 1.5 / 2, sa, sa, sa / 2].map((f) => this.pluckBuffer(f, 5.5));
    this.nextPluck = ctx.currentTime + 0.5;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.start();
    if (!this.ctx) return;
    if (on && this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.6);
  }

  private impulse(sec: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return b;
  }

  /** Karplus-Strong string with a soft-clipped "jawari" buzz. */
  private pluckBuffer(freq: number, sec: number) {
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * sec);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const N = Math.floor(sr / freq);
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    let prev = 0;
    for (let i = 0; i < len; i++) {
      const a = ring[idx];
      const b = ring[(idx + 1) % N];
      const v = (a + b) * 0.4985;
      ring[idx] = v;
      idx = (idx + 1) % N;
      // buzz: brighten with a gentle nonlinearity, decaying with the note
      const env = Math.exp(-i / (sr * 2.2));
      const s = Math.tanh(v * (1.8 + env * 2.5));
      out[i] = (s * 0.7 + (s - prev) * 0.6 * env) * Math.min(1, i / 60) * 0.35;
      prev = s;
    }
    return buf;
  }

  private play(buf: AudioBuffer, gain: number, dest: AudioNode, rate = 1, pan = 0) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    s.connect(g).connect(p).connect(dest);
    s.start();
  }

  private burst(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass', when = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 2, dur + 0.05);
  }

  private tone(freq: number, dur: number, gain: number, sweep = 1, type: OscillatorType = 'sine', when = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  step(intensity: number, stone: boolean) {
    if (!this.enabled || !this.ctx) return;
    if (stone) this.burst(0.07, 1800 + Math.random() * 400, 1.2, 0.18 + intensity * 0.12);
    else this.burst(0.16, 700 + Math.random() * 300, 0.6, 0.22 + intensity * 0.15, 'lowpass');
  }

  land(k: number) {
    if (!this.enabled || !this.ctx) return;
    this.burst(0.3, 500, 0.5, 0.35 * k, 'lowpass');
  }

  station(id: string) {
    const levels: Record<string, number> = {
      dunes: 0.6, fort: 0.75, workshop: 0.35, bazaar: 0.3, haveli: 0.45, stepwell: 0.7, archery: 0.45,
      greatdunes: 0.6, serai: 0.5, chhatris: 1.0, observatory: 0.85, camp: 0.9,
    };
    this.droneLevel = levels[id] ?? 0.5;
  }

  update(_dt: number, tDay: number, speed: number, fireDist: number, chiselDist: number) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.tDay = tDay;
    // wind rises in the afternoon and over open dunes
    const w = 0.16 + 0.12 * Math.sin(now * 0.21) + speed * 0.1 + (tDay > 0.55 && tDay < 0.8 ? 0.08 : 0);
    this.windGain.gain.setTargetAtTime(w, now, 0.5);
    this.windFilter.frequency.setTargetAtTime(380 + 260 * Math.sin(now * 0.13) + speed * 300, now, 0.4);
    this.droneGain.gain.setTargetAtTime(0.45 * this.droneLevel, now, 1.5);

    if (now >= this.nextPluck) {
      const order = [0, 1, 2, 3];
      const k = order[this.pluckIdx % 4];
      this.play(this.strings[k], 0.55, this.droneGain, 1 + (Math.random() - 0.5) * 0.002, (k - 1.5) * 0.25);
      this.pluckIdx++;
      this.nextPluck = now + (this.pluckIdx % 4 === 0 ? 1.7 : 1.05);
    }
    if (chiselDist < 700 && now >= this.nextChisel) {
      const g = 0.25 * (1 - chiselDist / 700);
      this.tone(2600 + Math.random() * 500, 0.06, g, 0.8, 'triangle');
      this.burst(0.05, 3200, 3, g * 0.8);
      this.nextChisel = now + 0.32 + Math.random() * (Math.random() > 0.8 ? 1.2 : 0.25);
    }
    if (fireDist < 900 && now >= this.nextCrackle) {
      const g = 0.3 * (1 - fireDist / 900);
      this.burst(0.03 + Math.random() * 0.04, 1500 + Math.random() * 3000, 2, g);
      this.nextCrackle = now + 0.05 + Math.random() * 0.35;
    }
    const dawn = Math.max(0, 1 - Math.abs(tDay - 0.14) / 0.1);
    if (dawn > 0 && now >= this.nextBird) {
      const f = 2400 + Math.random() * 1800;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone(f * (1 + i * 0.05), 0.09, 0.06 * dawn, 1.3, 'sine', i * 0.11);
      this.nextBird = now + 0.8 + Math.random() * 2.5;
    }
    const night = this.tDay > 0.86 || this.tDay < 0.05 ? 1 : 0;
    if (night && now >= this.nextCricket) {
      for (let i = 0; i < 3; i++) this.tone(4600, 0.035, 0.025, 1, 'sine', i * 0.06);
      this.nextCricket = now + 0.6 + Math.random() * 0.8;
    }
  }
}
