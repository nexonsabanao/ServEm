import { redirect } from 'next/navigation';
import {
  ChatIcon,
  DeviceIcon,
  DocketIcon,
  FlagIcon,
  ShieldIcon,
  UserIcon,
} from '@/app/components/icons';
import { BlockedAccounts } from '@/app/components/settings/blocked-accounts';
import { DeleteAccountPanel } from '@/app/components/settings/delete-account';
import {
  SettingsField,
  SettingsGroup,
  SettingsRow,
  SettingsScreen,
} from '@/app/components/settings/settings-screen';
import { deletionPreview } from '@/lib/account-deletion';
import { getSessionProfile } from '@/lib/auth';
import { listBlockedAccounts, listOwnReports } from '@/lib/trust';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Privacy and your data — ServEm',
};

/**
 * What is kept, who sees it, and the controls that act on it now.
 *
 * The facts are rows in the same card the Settings index uses — one line each —
 * rather than paragraphs or a separate fact grid: a person opening this screen
 * wants the list, not to read about the list.
 */
export default async function PrivacySettingsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/?signin=1');

  const [blocked, reports, deletion] = await Promise.all([
    listBlockedAccounts(profile.id),
    listOwnReports(profile.id),
    deletionPreview(profile.id),
  ]);

  return (
    <SettingsScreen
      title="Privacy and your data"
      sub="What is kept, and what you can do about it."
    >
      <SettingsGroup title="What is stored">
        <SettingsField
          icon={UserIcon}
          label="On your account"
          value="Name, email, and a password hash or Google/Apple link."
        />
        <SettingsField
          icon={DocketIcon}
          label="Also stored"
          value="Preferences, requests and messages."
        />
        <SettingsField
          icon={ShieldIcon}
          label="Never asked for"
          value="Card details, precise location, contacts."
        />
        <SettingsField
          icon={ChatIcon}
          label="ServMates see"
          value="The service, area, message and your name."
        />
      </SettingsGroup>

      <section className="account-section" aria-label="Your data">
        <div className="account-section-head">
          <h2>Your data</h2>
        </div>
        <ul className="row-list">
          <SettingsField
            icon={DeviceIcon}
            label="Download your data"
            value="A JSON file of your account and work."
            control={
              <a className="set-secondary" href="/api/account/export" download>
                Download
              </a>
            }
          />
          <SettingsField
            icon={ShieldIcon}
            label="Delete this account"
            value="Removes your data now — finished bookings stay readable briefly."
          />
        </ul>

        {deletion && (
          <DeleteAccountPanel
            blockers={deletion.blockers}
            retainedBookings={deletion.retainedBookings}
            purgeAfterDays={deletion.purgeAfterDays}
            hasPassword={deletion.hasPassword}
          />
        )}
      </section>

      <section className="account-section" aria-label="Blocked accounts">
        <div className="account-section-head">
          <h2>Blocked accounts</h2>
        </div>
        <BlockedAccounts blocked={blocked} />
      </section>

      <SettingsGroup title="Reports">
        <SettingsRow
          href="/account/reports"
          label="Your reports"
          value={reports.length > 0 ? `${reports.length} sent for review` : 'Nothing reported'}
          icon={FlagIcon}
        />
      </SettingsGroup>

      <SettingsGroup title="Terms">
        <SettingsRow
          href="/terms"
          label="Terms and conditions"
          value="Booking rules and complaints"
          icon={DocketIcon}
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}
