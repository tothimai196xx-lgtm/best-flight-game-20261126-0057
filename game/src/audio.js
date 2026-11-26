// Procedural WebAudio for Golden Hour Courier — no audio files, everything is
// synthesised: engine drone, wind rush, ring chime, touchdown thud, UI clicks.
// The context is created on the first user gesture; every call is guarded so a
// headless screenshot run never throws.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineOsc2 = null, engineGain = null, windSrc = null, windGain = null, windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }

  function startEngine() {
    if (started || !ensure()) return;
    started = true;
    try {
      // Engine: two detuned saws through a lowpass, pitch follows throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 62;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 31;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 2;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(lp); engineOsc2.connect(lp);
      lp.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
      // Wind: looped noise buffer through a bandpass.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buf; windSrc.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass'; windFilter.frequency.value = 700; windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
      windSrc.start();
    } catch { /* audio is best-effort */ }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ensure()) return;
    try {
      const t0 = ctx.currentTime + when;
      const o = ctx.createOscillator();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch { /* ignore */ }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); startEngine(); },
    setMuted(m) { muted = m; if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.05); },
    isMuted() { return muted; },
    // Called every frame while flying: throttle 0..1, speed in kt, airborne bool.
    update(throttle, speedKt, airborne) {
      if (!ctx || !engineGain) return;
      try {
        const t = ctx.currentTime;
        const rpm = 55 + throttle * 95 + speedKt * 0.12;
        engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
        engineOsc2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
        engineGain.gain.setTargetAtTime(airborne ? 0.05 + throttle * 0.075 : 0.035 + throttle * 0.03, t, 0.1);
        windGain.gain.setTargetAtTime(Math.min(0.16, speedKt * 0.0009), t, 0.15);
        windFilter.frequency.setTargetAtTime(500 + speedKt * 6, t, 0.15);
      } catch { /* ignore */ }
    },
    ring() { // bright two-note chime, then a soft fifth
      tone(880, 0.28, 'sine', 0.22); tone(1318.5, 0.4, 'sine', 0.16, 0.07); tone(1760, 0.5, 'sine', 0.08, 0.14);
    },
    perfect() { tone(1046.5, 0.2, 'triangle', 0.2); tone(1568, 0.35, 'triangle', 0.18, 0.08); },
    thud(hard) { tone(hard ? 70 : 95, 0.25, 'sine', hard ? 0.5 : 0.3, 0, 38); tone(180, 0.12, 'triangle', 0.12); },
    stallWarn() { tone(620, 0.16, 'square', 0.07); tone(620, 0.16, 'square', 0.07, 0.22); },
    click() { tone(1200, 0.06, 'sine', 0.12); },
    success() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.16, i * 0.11)); },
    fail() { [392, 330, 262].forEach((f, i) => tone(f, 0.4, 'triangle', 0.14, i * 0.16)); },
  };
}
