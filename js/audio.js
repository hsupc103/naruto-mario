/**
 * WebAudio Procedural Anime Synthesizer for NARUTO × MARIO
 * Zero external audio dependencies; generates ninja pentatonic BGM & chakra SFX.
 */
class NinjaAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.bgmTimer = null;
    this.stepIndex = 0;
    this.currentStage = 0;
    this.isBossFight = false;
    this.isKuramaMode = false;
  }

  ensureContext() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled && this.ctx) {
      this.stopBgm();
    } else if (this.enabled) {
      this.startBgm();
    }
    return this.enabled;
  }

  playTone(freq, endFreq, duration, type = "triangle", gainVal = 0.14, delay = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(24, freq), now);
    if (endFreq && endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playNoise(duration = 0.18, gainVal = 0.14, filterFreq = 1200) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  playJump(isDouble = false) {
    if (!isDouble) {
      this.playTone(260, 620, 0.14, "square", 0.1);
    } else {
      this.playTone(380, 880, 0.16, "triangle", 0.13);
      this.playNoise(0.08, 0.06, 2200);
    }
  }

  playCoin() {
    this.playTone(987.77, 987.77, 0.07, "sine", 0.11, 0);
    this.playTone(1318.51, 1318.51, 0.22, "sine", 0.12, 0.065);
  }

  playBlockBump() {
    this.playTone(150, 75, 0.09, "square", 0.12);
  }

  playItemSpawn() {
    const notes = [330, 392, 659, 523, 587, 784];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.02, 0.07, "triangle", 0.1, idx * 0.045);
    });
  }

  playMushroomPowerup() {
    // Iconic anime chakra surge + Mario powerup arpeggio
    const notes = [330, 440, 554, 659, 880, 1108, 1318];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.06, 0.11, "sawtooth", 0.11, idx * 0.045);
    });
    this.playNoise(0.25, 0.09, 1800);
  }

  playRasenganShoot() {
    // High-speed swirling wind sphere launch
    this.playTone(420, 1180, 0.18, "sawtooth", 0.12, 0);
    this.playTone(840, 460, 0.22, "sine", 0.11, 0.03);
    this.playNoise(0.16, 0.1, 2600);
  }

  playRasenganHit(killed = false) {
    this.playTone(320, 90, 0.16, "sawtooth", 0.14, 0);
    this.playNoise(0.18, 0.14, killed ? 900 : 1600);
    if (killed) {
      this.playTone(520, 780, 0.12, "triangle", 0.1, 0.05);
    }
  }

  playStarKurama() {
    // Nine-Tails Kurama transformation roar + golden chord
    this.playTone(110, 55, 0.55, "sawtooth", 0.22, 0);
    this.playNoise(0.45, 0.18, 650);
    const chord = [440, 554.37, 659.25, 880, 1108.73];
    chord.forEach((f, idx) => {
      this.playTone(f, f * 1.03, 0.45, "triangle", 0.12, 0.08 + idx * 0.04);
    });
  }

  playChargePulse(progress01) {
    const base = 180 + progress01 * 760;
    this.playTone(base, base * 1.18, 0.09, "sawtooth", 0.08);
    this.playTone(base * 0.5, base * 0.55, 0.09, "sine", 0.09);
  }

  playBijuudamaBoom() {
    // Colossal Tailed Beast Bomb detonation
    this.playTone(95, 28, 0.95, "sawtooth", 0.28, 0);
    this.playTone(240, 42, 0.85, "square", 0.2, 0.04);
    this.playTone(1240, 180, 0.65, "sawtooth", 0.16, 0.02);
    this.playNoise(0.9, 0.26, 520);
  }

  playBossWarning() {
    for (let i = 0; i < 3; i++) {
      this.playTone(440, 220, 0.22, "sawtooth", 0.16, i * 0.26);
    }
  }

  playHurt() {
    this.playTone(300, 110, 0.24, "sawtooth", 0.16);
    this.playNoise(0.18, 0.12, 700);
  }

  playStageClear() {
    const fanfare = [440, 554, 659, 880, 659, 880, 1108];
    fanfare.forEach((n, i) => {
      this.playTone(n, n, 0.18, "triangle", 0.14, i * 0.11);
    });
  }

  startBgm() {
    if (this.bgmTimer) return;
    const scales = [
      // Stage 1: Konoha energetic pentatonic
      [220, 261.63, 293.66, 329.63, 392.0, 440, 329.63, 293.66],
      // Stage 2: Orochimaru minor mystic scale
      [196, 207.65, 261.63, 293.66, 311.13, 392, 311.13, 261.63],
      // Stage 3: Akatsuki storm scale
      [164.81, 196, 220, 246.94, 293.66, 329.63, 246.94, 196]
    ];
    this.bgmTimer = setInterval(() => {
      if (!this.enabled || !this.ctx || this.ctx.state !== "running") return;
      const scale = scales[this.currentStage % scales.length];
      const idx = this.stepIndex % scale.length;
      let freq = scale[idx];
      if (this.isKuramaMode) freq *= 1.25;
      else if (this.isBossFight) freq *= 1.12;

      this.playTone(freq, freq * 0.995, 0.16, this.isBossFight ? "sawtooth" : "triangle", 0.035);
      if (this.stepIndex % 2 === 0) {
        this.playTone(freq * 0.5, freq * 0.5, 0.12, "sine", 0.04);
      }
      this.stepIndex++;
    }, 210);
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

window.NinjaAudio = new NinjaAudioEngine();
