export function isSoundSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.AudioContext !== 'undefined';
}

// Synthesizes a short two-tone alert chime via the Web Audio API instead of
// shipping an audio file — keeps the bundle free of binary assets and the
// "sound" fully self-contained.
export function playNotificationSound(): void {
  if (!isSoundSupported()) return;

  const ctx = new AudioContext();
  const now = ctx.currentTime;

  [880, 660].forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = frequency;

    const startAt = now + index * 0.12;
    gain.gain.setValueAtTime(0.15, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.25);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.25);
  });
}
