export type SoundName = 'fire' | 'hit' | 'miss' | 'sunk' | 'win' | 'lose';

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx: Ctor | undefined =
    window.AudioContext ?? (window as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!Ctx) return null;
  ctx ??= new Ctx();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(
  ac: AudioContext,
  at: number,
  {
    from,
    to = from,
    duration,
    gain = 0.18,
    type = 'sine',
  }: { from: number; to?: number; duration: number; gain?: number; type?: OscillatorType },
) {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + duration);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(amp).connect(ac.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

function noise(
  ac: AudioContext,
  at: number,
  { duration, gain = 0.25, cutoff = 1200 }: { duration: number; gain?: number; cutoff?: number },
) {
  const frames = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, at);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(at);
  src.stop(at + duration);
}

export function playSound(name: SoundName): void {
  const ac = context();
  if (!ac) return;
  const now = ac.currentTime;
  switch (name) {
    case 'fire':
      tone(ac, now, { from: 900, to: 220, duration: 0.18, gain: 0.12, type: 'triangle' });
      break;
    case 'miss':
      noise(ac, now, { duration: 0.35, gain: 0.18, cutoff: 700 });
      tone(ac, now, { from: 320, to: 140, duration: 0.25, gain: 0.07, type: 'sine' });
      break;
    case 'hit':
      noise(ac, now, { duration: 0.4, gain: 0.35, cutoff: 2200 });
      tone(ac, now, { from: 180, to: 50, duration: 0.35, gain: 0.22, type: 'square' });
      break;
    case 'sunk':
      noise(ac, now, { duration: 0.7, gain: 0.4, cutoff: 1600 });
      tone(ac, now, { from: 140, to: 40, duration: 0.8, gain: 0.25, type: 'sawtooth' });
      tone(ac, now + 0.25, { from: 90, to: 35, duration: 0.6, gain: 0.18, type: 'square' });
      break;
    case 'win':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(ac, now + i * 0.13, { from: f, duration: 0.22, gain: 0.16, type: 'triangle' }),
      );
      break;
    case 'lose':
      [392, 329.63, 261.63, 196].forEach((f, i) =>
        tone(ac, now + i * 0.18, { from: f, duration: 0.3, gain: 0.16, type: 'sawtooth' }),
      );
      break;
  }
}

export function outcomeSound(outcome: 'hit' | 'miss' | 'sunk' | 'repeat'): SoundName | null {
  if (outcome === 'repeat') return null;
  return outcome;
}
