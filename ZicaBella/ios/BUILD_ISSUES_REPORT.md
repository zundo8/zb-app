# ZICABELLA iOS Build and Issue Report

Generated: 2026-05-08

## Executive Summary

The iOS project builds successfully in Xcode. No build-blocking errors were reported by the latest build.

The project still has a high warning volume:

- Current Xcode Issue Navigator warnings: 537 total warning-level diagnostics.
- Latest build log warning entries: 153 warning log entries.
- Latest build errors: 0.

Most warnings come from third-party React Native, Expo, Pods, and generated JavaScript bundle output. The only direct app-owned Swift source warning found is in `ZICABELLA/ZICABELLA/AppDelegate.swift`.

## Build Status

Status: Passed

Command source: Xcode `BuildProject`

Result:

- The project built successfully.
- No compiler or linker errors were emitted.
- Build elapsed time was about 38 seconds.

## Major Issues

### 1. AppDelegate uses APIs deprecated in iOS 26

Severity: Major

Affected file:

- `ZICABELLA/ZICABELLA/AppDelegate.swift:24`
- `ZICABELLA/ZICABELLA/AppDelegate.swift:38`

Warnings:

- `UIWindow(frame:)` is deprecated in iOS 26.0. Apple recommends `init(windowScene:)`.
- `UIScreen.main` is deprecated in iOS 26.0. Apple recommends using a `UIScreen` from scene context.
- `UIApplication.OpenURLOptionsKey` is deprecated in iOS 26.0. Apple recommends UIScene lifecycle URL handling.

Impact:

The app currently builds, but this is app-owned code and should be fixed before targeting newer iOS SDK behavior long-term. It may become a blocker in future Xcode or iOS SDK updates.

Recommended action:

- Move app window creation and URL handling toward scene-based lifecycle APIs.
- Confirm Expo/React Native template compatibility before editing this manually, because Expo templates may regenerate this file.

### 2. Generated JavaScript bundle has many undeclared global warnings

Severity: Major

Affected generated file:

- `DerivedData/.../Build/Products/Debug-iphoneos/main.jsbundle`

Observed count:

- 164 warnings matching `the variable ... was not declared`.

Examples:

- `console`, `window`, `self`, `Promise`, `URL`, `FormData`
- Browser/Web APIs such as `DOMParser`, `Worker`, `WebAssembly`, `WebGLRenderingContext`, `localStorage`, `indexedDB`
- Sentry and replay globals such as `__SENTRY_RELEASE__`, `__SENTRY_BROWSER_BUNDLE__`, `__RRWEB_EXCLUDE_IFRAME__`
- 3D/graphics-related globals such as `DracoDecoderModule`, `BASIS`, `Ammo`, `fflate`

Impact:

These are emitted during the bundle phase and do not stop compilation. They are still important because they indicate code or dependencies that assume browser-like globals inside a React Native runtime. Some may be harmless static analysis noise, but others can become runtime crashes if the code path executes on device without a polyfill or native replacement.

Recommended action:

- Identify which packages introduce browser-only code into the mobile bundle.
- Audit 3D, WebGL, Sentry Replay, and web-oriented modules.
- Add explicit React Native-compatible polyfills only for globals that are truly required.
- Avoid suppressing all bundle warnings until runtime-critical globals are reviewed.

### 3. Dependency stack has many iOS API deprecation warnings

Severity: Major

Observed count:

- 110 warnings matching `deprecated`.

Affected dependency areas include:

- `@react-native-community/netinfo`
- `react-native-webview`
- `react-native-reanimated`
- `react-native-worklets`
- `react-native-screens`
- `expo`, `expo-constants`, `expo-file-system`, `expo-gl`
- `SDWebImage`, `SDWebImageAVIFCoder`, `SDWebImageWebPCoder`
- React Native Fabric / legacy architecture headers

Examples:

- `currentRadioAccessTechnology` deprecated since iOS 12.
- `statusBarFrame`, `statusBarHidden`, and `windows` deprecated since iOS 13-15.
- React Native legacy architecture APIs marked for future removal.
- `WKProcessPool` deprecation in `react-native-webview`.

Impact:

These warnings are not app-owned source issues, but they show that parts of the native dependency stack are using older iOS APIs. The most important risk is future SDK compatibility, especially around legacy React Native architecture removal.

Recommended action:

- Upgrade Expo and React Native packages through the Expo-supported upgrade path.
- Keep `react-native-webview`, `react-native-reanimated`, `react-native-worklets`, `react-native-screens`, `@react-native-community/netinfo`, and Sentry current.
- Avoid directly patching `node_modules` unless using `patch-package` with a tracked patch.

## Minor Issues and Warnings

### 4. Nullability warnings in Objective-C headers

Severity: Minor

Observed count:

- 99 warnings matching nullability specifier issues.

Affected areas:

- `expo-modules-core`
- `expo-file-system`
- `react-native-reanimated`
- `@sentry/react-native`
- ExpoModulesCore public headers under Pods

Impact:

These warnings are noisy but usually low runtime risk. They can hide more important warnings in Xcode.

Recommended action:

- Prefer dependency upgrades.
- Do not edit generated Pods or `node_modules` directly unless maintaining tracked patches.

### 5. Run script phases run during every build

Severity: Minor

Observed count:

- 4 warnings.

Warnings:

- Pod script phase `Create Symlinks to Header Folders` has no output dependencies.
- Pod script phase `[CP-User] [Hermes] Replace Hermes for the right configuration, if needed` has no output dependencies.

Impact:

This increases build time and keeps warning noise in Xcode. It does not break the build.

Recommended action:

- For Pod-managed scripts, prefer dependency updates first.
- If the scripts are project-owned, add output files or explicitly disable dependency analysis when intentional.

### 6. Static library objects with no symbols

Severity: Minor

Affected areas:

- `RNScreens`
- `SDWebImage`
- `Sentry`
- Other Pod static library objects

Examples:

- `RNSScreenShadowNodeCommitHook.o has no symbols`
- `UIImage+GIF.o has no symbols`
- `SentryDummyPublicEmptyClass.o has no symbols`

Impact:

Usually harmless for category-only Objective-C files or placeholder objects. It mainly contributes to warning noise.

Recommended action:

- Leave alone unless accompanied by missing symbol linker errors.

### 7. App configuration review items

Severity: Minor to Major, depending on product behavior

Affected file:

- `ZICABELLA/ZICABELLA/Info.plist`
- `ZICABELLA/ZICABELLA/PrivacyInfo.xcprivacy`
- `ZICABELLA/ZICABELLA/ZICABELLARelease.entitlements`

Findings:

- `UIBackgroundModes` includes `location`, but `Info.plist` does not show location permission usage strings such as `NSLocationWhenInUseUsageDescription` or `NSLocationAlwaysAndWhenInUseUsageDescription`.
- `UIBackgroundModes` includes `processing`, but no `BGTaskSchedulerPermittedIdentifiers` key was visible in `Info.plist`.
- `PrivacyInfo.xcprivacy` declares required accessed API categories, but `NSPrivacyCollectedDataTypes` is empty.
- Release entitlements file is empty.

Impact:

These are not current build errors. They may become runtime permission issues or App Store review issues if the app actually uses background location, background processing, push notifications, analytics, payments, crash reporting, or tracking-related data collection.

Recommended action:

- Verify whether background location and background processing are truly required.
- Add required permission strings and background task identifiers if those capabilities are used.
- Review privacy manifest declarations against Firebase, Sentry, Razorpay, analytics, and app business data collection.
- Confirm release entitlements against production capabilities such as Push Notifications, Associated Domains, Sign in with Apple, or Keychain Sharing if used.

## Prioritized Fix Plan

1. Fix or template-align `AppDelegate.swift` iOS 26 deprecation warnings.
2. Audit generated bundle warnings for browser-only dependencies and missing React Native polyfills.
3. Upgrade Expo and React Native ecosystem packages through a supported compatibility matrix.
4. Review iOS background modes, privacy manifest, and entitlements before App Store submission.
5. Reduce Pod and script warning noise after dependency upgrades.

## Current Risk Level

Build release risk: Low, because the current build succeeds.

Future SDK maintenance risk: Medium, because app-owned lifecycle code and dependency code emit deprecation warnings.

Runtime risk: Medium, because the generated JavaScript bundle references many browser globals that may not exist in React Native at runtime.

App Store compliance risk: Medium, pending confirmation of actual location, background processing, analytics, payment, crash reporting, and push notification behavior.
