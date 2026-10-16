import { redirect } from 'next/navigation';
import { BagIcon, DocketIcon } from '@/app/components/icons';
import { SettingsRow, SettingsScreen } from '@/app/components/settings/settings-screen';
import { getSessionProfile } from '@/lib/auth';
import { getOwnServmateProfile } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Selling on ServEm — ServEm',
};

/** The provider side of this account: the console, verification and payouts. */
export default async function SellingSettingsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/?signin=1');

  const servmate = await getOwnServmateProfile(profile.id);

  return (
    <SettingsScreen
      title="Selling on ServEm"
      sub="Your provider side. The same account can buy and sell."
    >
      <ul className="row-list">
        <SettingsRow
          href="/servmate"
          label="ServMate console"
          value={servmate ? 'Your profile, listings and requests' : 'Not set up yet — open it to start'}
          icon={DocketIcon}
        />
        <SettingsRow
          href="/servmate/jobs"
          label="Jobs you can offer on"
          value="Private jobs your categories and areas match"
          icon={BagIcon}
        />
      </ul>

      <section className="account-section" aria-label="Verification and payouts">
        <div className="account-section-head">
          <h2>Verification and payouts</h2>
        </div>
        <div className="set-rows">
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">Verification</span>
              <span className="set-row-note">
                Profiles are self-declared, so nothing claims a credential was checked.
              </span>
            </div>
            <div className="set-row-control">
              <span className="set-gate">Not connected</span>
            </div>
          </div>
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">Payouts</span>
              <span className="set-row-note">
                No money moves through ServEm. You settle with the customer directly.
              </span>
            </div>
            <div className="set-row-control">
              <span className="set-gate">Not enabled</span>
            </div>
          </div>
        </div>
      </section>
    </SettingsScreen>
  );
}
