import { redirect } from 'next/navigation';
import { DeviceIcon, FlagIcon } from '@/app/components/icons';
import { BlockedAccounts } from '@/app/components/settings/blocked-accounts';
import { SettingsRow, SettingsScreen } from '@/app/components/settings/settings-screen';
import { getSessionProfile } from '@/lib/auth';
import { listBlockedAccounts, listOwnReports } from '@/lib/trust';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Privacy and your data — ServEm',
};

/**
 * What is kept, who sees it, and the controls that act on it now.
 *
 * The facts are stated as facts in a grid rather than as reassurance in
 * paragraphs: a person opening this screen wants to know the list, not to read
 * about the list.
 */
export default async function PrivacySettingsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/?signin=1');

  const [blocked, reports] = await Promise.all([
    listBlockedAccounts(profile.id),
    listOwnReports(profile.id),
  ]);

  return (
    <SettingsScreen
      title="Privacy and your data"
      sub="What ServEm keeps, what it never asks for, and what you can do about it."
    >
      <section className="account-section" aria-label="What is stored">
        <div className="account-section-head">
          <h2>What is stored</h2>
        </div>
        <dl className="job-facts">
          <div>
            <dt>On your account</dt>
            <dd>Name, email, password hash or Google/Apple link</dd>
          </div>
          <div>
            <dt>On your account</dt>
            <dd>Preferences, requests and the messages on them</dd>
          </div>
          <div>
            <dt>Never asked for</dt>
            <dd>Card details, precise location, contacts</dd>
          </div>
          <div>
            <dt>ServMates see</dt>
            <dd>The service, area and message on a request, plus your name</dd>
          </div>
        </dl>
      </section>

      <section className="account-section" aria-label="Your data">
        <div className="account-section-head">
          <h2>Your data</h2>
        </div>
        <div className="set-rows">
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">Download your data</span>
              <span className="set-row-note">
                A JSON file with your account, preferences, requests and messages.
              </span>
            </div>
            <div className="set-row-control">
              <a className="set-secondary" href="/api/account/export" download>
                Download
              </a>
            </div>
          </div>
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">Delete this account</span>
              <span className="set-row-note">
                Retention rules for live bookings are still an open decision, so deletion is off.
              </span>
            </div>
            <div className="set-row-control">
              <span className="set-gate">Not enabled</span>
            </div>
          </div>
        </div>
      </section>

      <section className="account-section" aria-label="Blocked accounts">
        <div className="account-section-head">
          <h2>Blocked accounts</h2>
        </div>
        <BlockedAccounts blocked={blocked} />
      </section>

      <section className="account-section" aria-label="Reports">
        <div className="account-section-head">
          <h2>Reports</h2>
        </div>
        <ul className="row-list">
          <SettingsRow
            href="/account/reports"
            label="Your reports"
            value={
              reports.length > 0
                ? `${reports.length} sent for review`
                : 'Nothing reported so far'
            }
            icon={FlagIcon}
          />
        </ul>
      </section>

      <section className="account-section" aria-label="Terms">
        <div className="account-section-head">
          <h2>Terms</h2>
        </div>
        <ul className="row-list">
          <SettingsRow
            href="/terms"
            label="Terms and conditions"
            value="Booking rules, payment and complaints"
            icon={DeviceIcon}
          />
        </ul>
      </section>
    </SettingsScreen>
  );
}
