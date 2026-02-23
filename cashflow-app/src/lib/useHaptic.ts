/**
 * useHaptic — thin wrapper around navigator.vibrate() for tactile feedback.
 * Returns a noop on browsers/devices that don't support the Vibration API.
 */
export function useHaptic() {
  return function haptic(pattern: number | number[] = 10) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Vibration API blocked or unavailable — fail silently
      }
    }
  };
}
