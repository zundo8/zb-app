import { useAuthStore } from '../store/authStore';
import { config } from '../constants/config';

/**
 * Real OTP sending service integrated with Twilio via Next.js API
 */
export async function sendOTP(phone: string): Promise<boolean> {
  console.log(`[Auth] Sending OTP to ${phone}`);
  try {
    const res = await fetch(`${config.appUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    return res.ok;
  } catch (e) {
    console.error("[Auth] Send OTP error:", e);
    return false;
  }
}

/**
 * Real OTP verification service integrated with database via Next.js API
 */
export async function verifyOTP(phone: string, otp: string): Promise<boolean> {
  console.log(`[Auth] Verifying OTP ${otp} for ${phone}`);
  
  try {
    const res = await fetch(`${config.appUrl}/api/auth/mobile-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });

    const data = await res.json();
    if (res.ok && data.user) {
      useAuthStore.getState().login(data.user, data.token);
      return true;
    } else {
      console.error("[Auth] Verify failed:", data.error);
      return false;
    }
  } catch (e) {
    console.error("[Auth] Network error:", e);
    return false;
  }
}

export async function signOut(): Promise<void> {
  useAuthStore.getState().logout();
}
