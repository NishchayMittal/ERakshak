export function getAudioContext(): AudioContext | null {
  return null;
}

export const playHoverSound = () => {};
export const playClickSound = () => {};
export const playWhooshSound = () => {};
export const playNotificationSound = () => {};

export function useSciFiSounds() {
  return {
    playHover: playHoverSound,
    playClick: playClickSound,
    playWhoosh: playWhooshSound,
    playNotification: playNotificationSound,
  };
}
