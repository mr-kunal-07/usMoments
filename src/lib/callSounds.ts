/**
 * Web Audio API ringtone & dialing tone generators.
 * No external files needed — pure synthesised tones.
 */

let audioCtx: AudioContext | null = null;
let activeNodes: { oscillators: OscillatorNode[]; gain: GainNode } | null = null;
let loopTimer: ReturnType<typeof setInterval> | null = null;

function getCtx() {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function stopActive() {
  if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
  if (activeNodes) {
    activeNodes.oscillators.forEach(o => { try { o.stop(); } catch { /* oscillator already stopped */ } });
    activeNodes.gain.disconnect();
    activeNodes = null;
  }
}

/**
 * Classic phone ringtone pattern: two-tone burst, pause, repeat.
 * Frequencies: 440 Hz + 480 Hz (US standard ring)
 */
export function playRingtone() {
  stopActive();
  const ctx = getCtx();

  function ringBurst() {
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    gain.connect(ctx.destination);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = "sine";
    o2.type = "sine";
    o1.frequency.value = 440;
    o2.frequency.value = 480;
    o1.connect(gain);
    o2.connect(gain);

    o1.start();
    o2.start();

    // Ring for 1s, silence for 2s (handled by interval)
    setTimeout(() => {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      setTimeout(() => {
        try { o1.stop(); o2.stop(); } catch { /* oscillators already stopped */ }
        gain.disconnect();
      }, 150);
    }, 1000);
  }

  ringBurst();
  loopTimer = setInterval(ringBurst, 3000); // 1s ring + 2s silence
}

/**
 * Outgoing call dialing tone: single tone beep pattern.
 * Frequency: 440 Hz, 1s on / 3s off (US ringback tone)
 */
export function playDialingTone() {
  stopActive();
  const ctx = getCtx();

  function dialBurst() {
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 440;
    osc.connect(gain);
    osc.start();

    setTimeout(() => {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      setTimeout(() => {
        try { osc.stop(); } catch { /* oscillator already stopped */ }
        gain.disconnect();
      }, 150);
    }, 1000);
  }

  dialBurst();
  loopTimer = setInterval(dialBurst, 4000); // 1s tone + 3s silence
}

/** Stop any playing ringtone or dialing tone */
export function stopCallSound() {
  stopActive();
}
