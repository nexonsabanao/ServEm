import { DeviceDataPanel } from '@/app/components/settings/device-data';
import { SettingsScreen } from '@/app/components/settings/settings-screen';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'This device — ServEm',
};

/**
 * The build you are using and what it keeps in this browser.
 *
 * A local development build stores accounts, requests and preferences on this
 * machine in one unencrypted file, and the page says so rather than looking more
 * finished than it is.
 */
export default function DeviceSettingsPage() {
  return (
    <SettingsScreen title="This device" sub="What this browser holds, and what this build is.">
      <DeviceDataPanel />

      <section className="account-section" aria-label="This build">
        <div className="account-section-head">
          <h2>This build</h2>
        </div>
        <p className="account-dev-note">
          Local development build. Accounts, requests and preferences are stored on this machine in
          a single unencrypted file, not a production datastore.
        </p>
      </section>
    </SettingsScreen>
  );
}
