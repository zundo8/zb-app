/**
 * Firebase Configuration
 *
 * @react-native-firebase is a NATIVE module. It reads all configuration from
 * the native `GoogleService-Info.plist` (iOS) / `google-services.json` (Android)
 * and auto-initializes the [DEFAULT] Firebase app at startup.
 *
 * ❌ Do NOT call firebase.initializeApp() with a JS config here — that would
 *    conflict with the native auto-initialisation and produce errors like
 *    "Missing or invalid FirebaseOptions property 'databaseURL'".
 *
 * ✅ Simply import and re-export the native app instance.
 */
import firebase from '@react-native-firebase/app';

export default firebase;
