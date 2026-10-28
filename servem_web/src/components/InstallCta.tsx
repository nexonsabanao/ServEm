import { Download } from 'lucide-react';
import {
  ANDROID_APK,
  ANDROID_APK_SIZE,
  APP_VERSION,
  IOS_BUILD,
  currentPlatform,
} from '../lib/release';

/**
 * The install control: an Android visitor gets the APK, an iPhone gets the
 * honest state of the iOS build, and a desktop visitor sees both.
 */
export function InstallCta() {
  const platform = currentPlatform();

  return (
    <div className="landing-hero-buttons">
      {platform === 'ios' ? null : (
        <>
          <a
            href={ANDROID_APK.url}
            className="btn btn-primary btn-pill btn-block"
          >
            <Download size={17} aria-hidden="true" /> Download for Android
          </a>
          <p className="landing-download-note">
            Version {APP_VERSION} · {ANDROID_APK_SIZE}. Open the file on your Android phone to install; your
            browser may ask for permission first.
          </p>
        </>
      )}
      {platform === 'android' ? null : (
        <div className="landing-install-card">
          <strong>{IOS_BUILD.label}</strong>
          <span>{IOS_BUILD.note}</span>
        </div>
      )}
    </div>
  );
}
