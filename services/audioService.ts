
class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmNodes: AudioNode[] = [];
  private volume: number = 0.4;

  constructor() {
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume; 
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.error("AudioContext not supported");
    }
  }

  public ensureContext() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMasterVolume(val: number) {
      if (this.masterGain) {
          this.volume = Math.max(0, Math.min(1, val));
          this.masterGain.gain.setTargetAtTime(this.volume, this.ctx?.currentTime || 0, 0.1);
      }
  }

  // --- SYNTHESIS HELPERS ---

  private createOsc(type: OscillatorType, freq: number, startTime: number, stopTime: number) {
    if (!this.ctx || !this.masterGain) return null;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(startTime);
    osc.stop(stopTime);
    
    return { osc, gain };
  }

  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // --- BACKGROUND MUSIC (GENERATIVE DRONE) ---

  startAmbient() {
    if (!this.ctx || !this.masterGain || this.bgmNodes.length > 0) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    const rootFreq = 55; // A1

    // Drone 1: Sine
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = rootFreq;
    
    // Drone 2: Sawtooth (Detuned)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = rootFreq * 1.01;

    // Filter for Sawtooth
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 120;
    filter.Q.value = 1;

    // LFO for filter modulation
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1; // Slow breathing
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 50; 

    // Gains
    const gain1 = this.ctx.createGain();
    gain1.gain.value = 0.15;
    
    const gain2 = this.ctx.createGain();
    gain2.gain.value = 0.08;

    // Connections
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    osc1.connect(gain1);
    osc2.connect(filter);
    filter.connect(gain2);

    gain1.connect(this.masterGain);
    gain2.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    lfo.start(t);

    this.bgmNodes = [osc1, osc2, lfo, gain1, gain2, filter, lfoGain];
  }

  stopAmbient() {
    this.bgmNodes.forEach(node => {
      try {
        if (node instanceof OscillatorNode) node.stop();
        node.disconnect();
      } catch (e) {}
    });
    this.bgmNodes = [];
  }

  // --- SOUND EFFECTS ---

  playClick() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // High pitch blip
    const { gain } = this.createOsc('sine', 1200, t, t + 0.05)!;
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  }

  playConfirm() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Ascending arpeggio
    const note1 = this.createOsc('square', 440, t, t + 0.1)!;
    note1.gain.gain.value = 0.05;
    
    const note2 = this.createOsc('square', 880, t + 0.1, t + 0.25)!;
    note2.gain.gain.value = 0.05;
    note2.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  }

  playError() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { osc, gain } = this.createOsc('sawtooth', 150, t, t + 0.3)!;
    osc.frequency.linearRampToValueAtTime(100, t + 0.3);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.3);
  }

  playPhaseNight() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    // Alarm sound
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.linearRampToValueAtTime(300, t + 0.5);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.8);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.8);
  }

  playPhaseDay() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    // Bright chord
    const freqs = [523.25, 659.25, 783.99]; // C Major
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0, t);
      gain.gain.linearRampToValueAtTime(0.05, t + 0.1 + (i*0.05));
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 2);
    });
  }

  playAttack() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    // Noise Burst (Impact)
    const buffer = this.createNoiseBuffer();
    if (buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const gain = this.ctx.createGain();
      
      // Filter for crunch
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, t);
      filter.frequency.exponentialRampToValueAtTime(100, t + 0.2);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      source.start(t);
      source.stop(t + 0.2);
    }
  }

  playDefend() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Metallic Ping
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2000, t);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  playRun() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Whoosh
    const buffer = this.createNoiseBuffer();
    if (buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const gain = this.ctx.createGain();
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(200, t);
      filter.frequency.linearRampToValueAtTime(800, t + 0.3);

      gain.gain.setValueAtTime(0.0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.15);
      gain.gain.linearRampToValueAtTime(0.0, t + 0.3);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      source.start(t);
      source.stop(t + 0.3);
    }
  }

  playEat() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Quick low noise bursts
    const buffer = this.createNoiseBuffer();
    if (buffer) {
      for (let i = 0; i < 3; i++) {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        const start = t + (i * 0.08);
        
        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.05);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        source.start(start);
        source.stop(start + 0.05);
      }
    }
  }

  playRest() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Soft sine swell
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.5);
    gain.gain.linearRampToValueAtTime(0.0, t + 1.0);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 1.0);
  }

  playDeath() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Low dissonant thud
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(80, t);
    osc1.frequency.linearRampToValueAtTime(40, t + 1.0);
    
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(110, t); // Tritone ish
    osc2.frequency.linearRampToValueAtTime(55, t + 1.0);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain!);
    osc1.start(t);
    osc1.stop(t + 1.5);
    osc2.start(t);
    osc2.stop(t + 1.5);
  }
}

export const audioManager = new AudioService();
