// Sign in with Apple - requires expo-apple-authentication
import { NativeModules } from 'react-native';
import { useAuthStore } from '../store/authStore';

const isNativeAppleAuthAvailable = !!(
  NativeModules.ExpoAppleAuthentication || 
  NativeModules.NativeModulesProxy?.ExpoAppleAuthentication
);

export async function isAppleSignInAvailable(): Promise<boolean> {
  try {
    if (!isNativeAppleAuthAvailable) return false;
    const AppleAuthentication = require('expo-apple-authentication');
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<boolean> {
  try {
    if (!isNativeAppleAuthAvailable) return false;
    const AppleAuthentication = require('expo-apple-authentication');
    
    if (!(await isAppleSignInAvailable())) {
      return false;
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const user = {
      id: credential.user,
      name: [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ') || 'Apple User',
      email: credential.email || '',
      phone: '',
    };

    const token = credential.identityToken || `apple-${credential.user}`;
    useAuthStore.getState().login(user, token);

    return true;
  } catch (error: any) {
    return false;
  }
}
