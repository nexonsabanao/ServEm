/**
 * The single owner of what a visitor can install.
 *
 * Android: the release APK is a GitHub Release asset on this repository, under
 * the tag in `ANDROID_RELEASE_TAG`, not a file in the tree. Keeping it in
 * Releases means the repository holds only source, the download URL is stable,
 * and Firebase Hosting does not need to carry a 56 MB binary — the Spark plan
 * rejects `.apk` uploads outright ("Executable files are forbidden").
 *
 * Publishing a new build:
 *
 *   cd servem_app && flutter build apk --release
 *   gh release create v<version>-android \
 *     build/app/outputs/flutter-apk/app-release.apk#ServEm.apk
 *
 * then update `ANDROID_RELEASE_TAG` (if the tag changed), `sizeBytes` and
 * `APP_VERSION` here, so the page never advertises a build it does not serve.
 *
 * iOS: there is no artefact yet. Producing one needs a Mac with a full Xcode
 * install (`sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer`),
 * CocoaPods, an Apple Developer team id wired into `ios/Runner.xcodeproj`
 * (`DEVELOPMENT_TEAM`, currently unset), then `flutter build ipa --release` and
 * a TestFlight upload. None of that exists in this checkout, so the UI says so
 * instead of handing an iPhone an Android file.
 */

/** Must match `version` in servem_app/pubspec.yaml. */
export const APP_VERSION = '1.0.0';

/** The GitHub Release tag that holds the Android artifact. */
export const ANDROID_RELEASE_TAG = 'v1.0.0-android';

export const ANDROID_APK = {
  url: `https://github.com/nexonsabanao/ServEm/releases/download/${ANDROID_RELEASE_TAG}/ServEm.apk`,
  /** Exact size of the release build this page ships. */
  sizeBytes: 58_265_107,
} as const;

export const ANDROID_APK_SIZE = `${Math.round(ANDROID_APK.sizeBytes / 1_000_000)} MB`;

export const IOS_BUILD = {
  available: false,
  label: 'iOS build not available yet',
  note: 'The iPhone app is still being built and will open through TestFlight once it exists. On an iPhone, use ServEm in this browser for now.',
} as const;

export type Platform = 'android' | 'ios' | 'desktop';

/** Android phones say "Android"; iPhones and iPads get their own branch. */
export function platformFor(userAgent: string, maxTouchPoints = 0): Platform {
  const ua = userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipod') || ua.includes('ipad')) return 'ios';
  // iPadOS 13+ presents itself as desktop Safari; only touch points betray it.
  if (ua.includes('macintosh') && maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

export function currentPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  return platformFor(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}
