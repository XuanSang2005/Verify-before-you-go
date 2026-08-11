import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function usePreviewReducedMotion(): boolean {
  const [enabled, setEnabled] = useState(() => (
    Platform.OS === 'web'
    && typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  ));

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handleChange = (event: MediaQueryListEvent) => setEnabled(event.matches);
      query.addEventListener?.('change', handleChange);
      return () => query.removeEventListener?.('change', handleChange);
    }

    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setEnabled(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
