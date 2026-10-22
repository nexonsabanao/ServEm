import { DeviceIcon } from '@/app/components/icons';
import { DeviceDataPanel } from '@/app/components/settings/device-data';
import {
  SettingsField,
  SettingsGroup,
  SettingsScreen,
} from '@/app/components/settings/settings-screen';

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
    <SettingsScreen title="This device" sub="What this browser holds.">
      <section className="account-section" aria-label="This browser">
        <div className="account-section-head">
          <h2>This browser</h2>
        </div>
        <DeviceDataPanel />
      </section>

      <SettingsGroup title="This build">
        <SettingsField
          icon={DeviceIcon}
          label="Local development build"
          value="Accounts, requests and preferences sit unencrypted in one file on this machine."
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}
