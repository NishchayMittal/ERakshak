import { useEffect } from 'react';

let globalAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!globalAudioCtx) {
      globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume().catch(() => { });
    }
    return globalAudioCtx;
  } catch (err) {
    console.warn('AudioContext not supported or blocked:', err);
    return null;
  }
}

export const playHoverSound = (e?: any) => {
  if (e) {
    if (e.__sound_hover_played) return;
    e.__sound_hover_played = true;
  }
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.1);
};

export const playClickSound = (e?: any) => {
  if (e) {
    if (e.__sound_click_played) return;
    e.__sound_click_played = true;
  }
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(900, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.06);

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.005);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.06);
};

export const playWhooshSound = (e?: any) => {
  if (e) {
    if (e.__sound_whoosh_played) return;
    e.__sound_whoosh_played = true;
  }
  const ctx = getAudioContext();
  if (!ctx) return;

  const bufferSize = ctx.sampleRate * 0.4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(400, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.4);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.1);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start();
};

export const playNotificationSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Dual chime oscillator 1 (high note)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(523.25, now); // C5
  osc1.frequency.setValueAtTime(659.25, now + 0.1); // E5

  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(0.06, now + 0.02);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.4);

  // Dual chime oscillator 2 (subtle harmony)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(783.99, now); // G5

  gain2.gain.setValueAtTime(0, now);
  gain2.gain.linearRampToValueAtTime(0.03, now + 0.05);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.35);
};

// Singleton global event delegation listeners
if (typeof window !== 'undefined') {
  const resumeAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => { });
    }
  };
  window.addEventListener('click', resumeAudio, { once: true });
  window.addEventListener('keydown', resumeAudio, { once: true });

  let lastHoveredElement: Element | null = null;

  // Global hover delegation listener
  window.addEventListener('mouseover', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    const interactive = target.closest('button, a, [role="button"], .cyber-button, .cursor-pointer');
    if (interactive && interactive !== lastHoveredElement) {
      lastHoveredElement = interactive;
      // Skip if mouseover already handled manually
      const ae = e as any;
      if (ae.__sound_hover_played) return;
      ae.__sound_hover_played = true;

      try {
        playHoverSound();
      } catch (err) { }
    } else if (!interactive) {
      lastHoveredElement = null;
    }
  });

  // Global click delegation listener
  window.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    const interactive = target.closest('button, a, [role="button"], .cyber-button, .cursor-pointer');
    if (interactive) {
      const ae = e as any;
      if (ae.__sound_click_played) return;
      ae.__sound_click_played = true;

      try {
        playClickSound();
      } catch (err) { }
    }
  });
}

export function useSciFiSounds() {
  return {
    playHover: playHoverSound,
    playClick: playClickSound,
    playWhoosh: playWhooshSound,
    playNotification: playNotificationSound,
  };
}
