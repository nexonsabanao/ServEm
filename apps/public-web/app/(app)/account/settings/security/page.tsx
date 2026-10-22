import { redirect } from 'next/navigation';
import { DeviceIcon, LockIcon, ShieldIcon } from '@/app/components/icons';
import {
  SettingsField,
  SettingsGroup,
  SettingsScreen,
} from '@/app/components/settings/settings-screen';
import { OtherDevicesPanel, PasswordForm } from '@/app/components/settings/security-forms';
import { getSessionProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign-in and security — ServEm',
};

/** Password and sessions: the two things that decide who can be you. */
export default async function SecuritySettingsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/?signin=1');

  return (
    <SettingsScreen
      title="Sign-in and security"
      sub="Your password and signed-in sessions."
    >
      <section className="account-section" aria-label="Password">
        <div className="account-section-head">
          <h2>Password</h2>
        </div>
        <PasswordForm hasPassword={profile.hasPassword} />
      </section>

      <SettingsGroup title="Sessions">
        <SettingsField
          icon={DeviceIcon}
          label="Other devices"
          value="Ends every other session, keeping this browser."
          control={<OtherDevicesPanel />}
        />
        <SettingsField
          icon={LockIcon}
          label="Two-factor authentication"
          value="Not built — sign-in is a password, Google or Apple."
          control={<span className="set-gate">Not enabled</span>}
        />
        <SettingsField
          icon={ShieldIcon}
          label="Sign-in activity"
          value="No device list is kept."
          control={<span className="set-gate">Not recorded</span>}
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}
