import * as Haptics from 'expo-haptics';

/**
 * Standardized Haptics with try-catch guards to prevent app crashes
 * if native modules are missing (e.g. in development/simulators).
 */
export const haptics = {
  addToCart: () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
  },
  buttonTap: () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  },
  success: () => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  },
  error: () => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
  },
  quantityChange: () => {
    try { Haptics.selectionAsync(); } catch {}
  },
  cartShake: () => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  },
  tabPress: () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  },
};
