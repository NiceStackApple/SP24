
class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmNodes: AudioNode[] = [];
  private volume: number = 0.4;
  
  // Dynamic Synth nodes for updates
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

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

  // --- BACKGROUND MUSIC (DYNAMIC GENERATIVE DRONE) ---

  startAmbient(day: number = 1) {
    if (!this.ctx || !this.masterGain || this.bgmNodes.length > 0) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    
    // Intensity scaling (0.0 to 1.0 based on day 1 to 50)
    const intensity = Math.min((day - 1) / 50, 1.0);
    const rootFreq = 55 + (intensity * 20); // Frequency climbs slightly with days

    // Drone 1: Sine (Foundational)
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sine';
    this.osc1.frequency.setValueAtTime(rootFreq, t);
    
    // Drone 2: Sawtooth (Harsher, detuned based on intensity)
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'sawtooth';
    // More intensity = more dissonance (detune)
    const detune = 1.01 + (intensity * 0.05); 
    this.osc2.frequency.setValueAtTime(rootFreq * detune, t);

    // Filter for Sawtooth
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    // Opening filter adds high-frequency pressure
    this.filter.frequency.setValueAtTime(120 + (intensity * 400), t);
    this.filter.Q.setValueAtTime(1 + (intensity * 10), t);

    // LFO for filter modulation (Pulsing Anxiety)
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = 'sine';
    // Faster days = Faster pulse
    this.lfo.frequency.setValueAtTime(0.1 + (intensity * 2.5), t);
    
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.setValueAtTime(50 + (intensity * 150), t); 

    // Gains
    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0.15, t);
    
    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0.08 + (intensity * 0.05), t);

    // Connections
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);

    this.osc1.connect(gain1);
    this.osc2.connect(this.filter);
    this.filter.connect(gain2);

    gain1.connect(this.masterGain);
    gain2.connect(this.masterGain);

    this.osc1.start(t);
    this.osc2.start(t);
    this.lfo.start(t);

    this.bgmNodes = [this.osc1, this.osc2, this.lfo, gain1, gain2, this.filter, this.lfoGain];
  }

  public updateAmbient(day: number) {
    if (!this.ctx || !this.osc1 || !this.osc2 || !this.filter || !this.lfo || !this.lfoGain) return;
    
    const t = this.ctx.currentTime;
    const intensity = Math.min((day - 1) / 50, 1.0);
    const rootFreq = 55 + (intensity * 20);
    const detune = 1.01 + (intensity * 0.05);

    // Smoothly ramp parameters to new intensity levels
    this.osc1.frequency.exponentialRampToValueAtTime(rootFreq, t + 2);
    this.osc2.frequency.exponentialRampToValueAtTime(rootFreq * detune, t + 2);
    
    this.filter.frequency.exponentialRampToValueAtTime(120 + (intensity * 400), t + 2);
    this.filter.Q.setTargetAtTime(1 + (intensity * 10), t, 0.5);
    
    this.lfo.frequency.setTargetAtTime(0.1 + (intensity * 2.5), t, 1.0);
    this.lfoGain.gain.setTargetAtTime(50 + (intensity * 150), t, 1.0);
  }

  stopAmbient() {
    this.bgmNodes.forEach(node => {
      try {
        if (node instanceof OscillatorNode) node.stop();
        node.disconnect();
      } catch (e) {}
    });
    this.bgmNodes = [];
    this.osc1 = null;
    this.osc2 = null;
    this.filter = null;
    this.lfo = null;
    this.lfoGain = null;
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
