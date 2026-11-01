/* Procedural audio engine. No audio files are used. */
(() => {
  "use strict";

  const GameHub = window.GameHub;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const mutedKey = GameHub.keys.soundMuted;

  const engine = {
    context: null,
    master: null,
    noiseBuffer: null,
    muted: GameHub.utils.readFlag(mutedKey)
  };

  function ensureContext() {
    if (!AudioContextClass) return null;

    if (!engine.context) {
      engine.context = new AudioContextClass();
      engine.master = engine.context.createGain();
      engine.master.gain.value = 0.62;
      engine.master.connect(engine.context.destination);
    }

    if (engine.context.state === "suspended") {
      engine.context.resume().catch(() => {});
    }

    return engine.context;
  }

  function getNoiseBuffer(context) {
    if (engine.noiseBuffer) return engine.noiseBuffer;

    const length = Math.floor(context.sampleRate * 0.12);
    engine.noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = engine.noiseBuffer.getChannelData(0);

    for (let index = 0; index < length; index += 1) {
      const decay = 1 - index / length;
      data[index] = (Math.random() * 2 - 1) * decay * decay;
    }

    return engine.noiseBuffer;
  }

  function unlock() {
    if (!engine.muted) ensureContext();
  }

  function playLanding(intensity = 0.7) {
    if (engine.muted) return;
    const context = ensureContext();
    if (!context) return;

    const now = context.currentTime;
    const strength = Math.min(1, Math.max(0.3, Number(intensity) || 0.7));

    const body = context.createOscillator();
    const bodyGain = context.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(132, now);
    body.frequency.exponentialRampToValueAtTime(48, now + 0.16);
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.32 * strength, now + 0.008);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);
    body.connect(bodyGain);
    bodyGain.connect(engine.master);
    body.start(now);
    body.stop(now + 0.25);

    const knock = context.createOscillator();
    const knockGain = context.createGain();
    knock.type = "triangle";
    knock.frequency.setValueAtTime(245, now);
    knock.frequency.exponentialRampToValueAtTime(150, now + 0.075);
    knockGain.gain.setValueAtTime(0.055 * strength, now);
    knockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    knock.connect(knockGain);
    knockGain.connect(engine.master);
    knock.start(now);
    knock.stop(now + 0.1);

    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = getNoiseBuffer(context);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(520, now);
    noiseGain.gain.setValueAtTime(0.1 * strength, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(engine.master);
    noise.start(now);
    noise.stop(now + 0.08);
  }

  function playMerge(value = 4) {
    if (engine.muted) return;
    const context = ensureContext();
    if (!context) return;

    const now = context.currentTime;
    const level = Math.min(1, Math.max(0, Math.log2(Math.max(4, value)) / 11));
    const base = 720 + level * 390;
    const partials = [
      { ratio: 1, gain: 0.085, decay: 0.48 },
      { ratio: 1.5, gain: 0.034, decay: 0.34 },
      { ratio: 2.01, gain: 0.017, decay: 0.25 }
    ];

    for (const partial of partials) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(base * partial.ratio, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(partial.gain, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + partial.decay);
      oscillator.connect(gain);
      gain.connect(engine.master);
      oscillator.start(now);
      oscillator.stop(now + partial.decay + 0.03);
    }
  }

  function updateSoundButton() {
    const button = document.getElementById("soundToggle");
    const label = document.getElementById("soundLabel");
    if (button) {
      button.dataset.muted = String(engine.muted);
      button.setAttribute("aria-pressed", String(engine.muted));
      button.setAttribute("aria-label", engine.muted ? "开启音效" : "关闭音效");
      button.setAttribute("title", engine.muted ? "开启音效" : "关闭音效");
    }
    if (label) label.textContent = engine.muted ? "静音" : "音效";
  }

  function setMuted(muted) {
    engine.muted = Boolean(muted);
    GameHub.utils.writeFlag(mutedKey, engine.muted);
    if (!engine.muted) ensureContext();
    updateSoundButton();
  }

  function bindInterface() {
    const button = document.getElementById("soundToggle");
    if (button) {
      button.addEventListener("click", () => setMuted(!engine.muted));
    }
    updateSoundButton();
  }

  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
  window.addEventListener("keydown", unlock, { once: true, capture: true });

  GameHub.audio = {
    unlock,
    merge: playMerge,
    land: playLanding,
    setMuted,
    toggleMuted: () => setMuted(!engine.muted),
    isMuted: () => engine.muted
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindInterface, { once: true });
  } else {
    bindInterface();
  }
})();
