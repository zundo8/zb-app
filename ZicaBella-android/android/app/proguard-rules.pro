# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ── React Native ──
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.**

# ── Zica Bella app classes ──
-keep class com.zicabella.app.** { *; }

# ── OkHttp (used by React Native networking) ──
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# ── Hermes JS engine ──
-keep class com.hermes.** { *; }

# ── AsyncStorage ──
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# ── Keep all native modules ──
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# ── react-native-reanimated ──
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ── react-native-gesture-handler ──
-keep class com.swmansion.gesturehandler.** { *; }

# ── react-native-safe-area-context ──
-keep class com.th3rdwave.safeareacontext.** { *; }

# ── react-native-svg (if used) ──
-keep class com.horcrux.svg.** { *; }

# ── Expo modules ──
-keep class expo.modules.** { *; }
-dontwarn expo.modules.**

# Add any project specific keep options here:
