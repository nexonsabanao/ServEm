import { redirect } from 'next/navigation';
import { BagIcon, DocketIcon, VerifiedIcon } from '@/app/components/icons';
import {
  SettingsField,
  SettingsGroup,
  SettingsRow,
  SettingsScreen,
} from '@/app/components/settings/settings-screen';
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
      sub="Your provider side."
    >
      <SettingsGroup title="Selling">
        <SettingsRow
          href="/servmate"
          label="ServMate console"
          value={servmate ? 'Profile and listings' : 'Set up'}
          icon={DocketIcon}
        />
        <SettingsRow
          href="/servmate/jobs"
          label="Jobs you can offer on"
          value="Jobs matching your areas"
          icon={BagIcon}
        />
      </SettingsGroup>

      <SettingsGroup title="Verification and payouts">
        <SettingsField
          icon={VerifiedIcon}
          label="Verification"
          value="Profiles are self-declared; no credential is checked."
          control={<span className="set-gate">Not connected</span>}
        />
        <SettingsField
          icon={BagIcon}
          label="Payouts"
          value="No money moves through ServEm — settle directly."
          control={<span className="set-gate">Not enabled</span>}
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}
