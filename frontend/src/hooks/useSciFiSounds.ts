import { useEffect } from 'react';

export function getAudioContext(): AudioContext | null {
  return null;
}

export const playHoverSound = (e?: any) => {};
export const playClickSound = (e?: any) => {};
export const playWhooshSound = (e?: any) => {};
export const playNotificationSound = () => {};

export function useSciFiSounds() {
  return {
    playHover: playHoverSound,
    playClick: playClickSound,
    playWhoosh: playWhooshSound,
    playNotification: playNotificationSound,
  };
}
