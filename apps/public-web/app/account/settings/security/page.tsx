import { redirect } from 'next/navigation';
import { SettingsScreen } from '@/app/components/settings/settings-screen';
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
      sub="Your password, and the sessions signed in to this account."
    >
      <section className="account-section" aria-label="Password">
        <div className="account-section-head">
          <h2>Password</h2>
        </div>
        <PasswordForm hasPassword={profile.hasPassword} />
      </section>

      <section className="account-section" aria-label="Sessions">
        <div className="account-section-head">
          <h2>Sessions</h2>
        </div>
        <div className="set-rows">
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">Other devices</span>
              <span className="set-row-note">Ends every session except this browser.</span>
            </div>
            <div className="set-row-control">
              <OtherDevicesPanel />
            </div>
          </div>
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">Two-factor authentication</span>
              <span className="set-row-note">
                Not built yet. Signing in is a password or a Google/Apple account.
              </span>
            </div>
            <div className="set-row-control">
              <span className="set-gate">Not enabled</span>
            </div>
          </div>
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">Sign-in activity</span>
              <span className="set-row-note">Sessions have an expiry but no device list.</span>
            </div>
            <div className="set-row-control">
              <span className="set-gate">Not recorded</span>
            </div>
          </div>
        </div>
      </section>
    </SettingsScreen>
  );
}
