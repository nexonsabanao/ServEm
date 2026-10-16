import { redirect } from 'next/navigation';
import {
  BagIcon,
  BellIcon,
  DeviceIcon,
  DocketIcon,
  FlagIcon,
  LockIcon,
  ShieldIcon,
  UserIcon,
} from '@/app/components/icons';
import { SettingsGroup, SettingsRow } from '@/app/components/settings/settings-screen';
import { getPreferences } from '@/lib/account';
import { getSessionProfile } from '@/lib/auth';
import { formatMonth } from '@/lib/format';
import { getOwnServmateProfile } from '@/lib/servmate-profile';
import { listBlockedAccounts, listOwnReports } from '@/lib/trust';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Settings — ServEm',
};

/**
 * Settings: a list of what you can change, each one showing what it is set to.
 *
 * The old screen was one long scroll that explained the whole system in prose.
 * This is the opposite: your name, email and join date appear here and nowhere
 * else, and every row is a door — the label says what it is, the value says what
 * it currently is, and the chevron says opening it is a screen, not a guess.
 */
export default async function SettingsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/?signin=1');

  const [preferences, blocked, reports, servmate] = await Promise.all([
    getPreferences(profile.id),
    listBlockedAccounts(profile.id),
    listOwnReports(profile.id),
    getOwnServmateProfile(profile.id),
  ]);

  const signIn = [
    profile.hasPassword ? 'Password' : null,
    ...profile.identities.map((identity) => providerLabel(identity.provider)),
  ].filter((method): method is string => Boolean(method));

  const switches = [
    preferences.notifyReplies,
    preferences.notifyRequestUpdates,
    preferences.notifyProductNews,
    preferences.reduceMotion,
    preferences.largerText,
  ];
  const on = switches.filter(Boolean).length;

  return (
    <div className="screen">
      <h1 className="screen-title">Settings</h1>

      <section className="me-card" aria-label="Account summary">
        <span className="me-avatar" aria-hidden="true">{initialFor(profile.name)}</span>
        <div className="me-copy">
          <p className="me-name">{profile.name}</p>
          <p className="me-line">{profile.email}</p>
          <p className="me-since">Member since {formatMonth(profile.createdAt)}</p>
        </div>
      </section>

      <SettingsGroup title="Your account">
        <SettingsRow
          href="/account/profile"
          label="Profile"
          value={profile.profile.area ? `Area: ${profile.profile.area}` : 'Area not set yet'}
          icon={UserIcon}
        />
        <SettingsRow
          href="/account/settings/security"
          label="Sign-in and security"
          value={signIn.length > 0 ? signIn.join(' · ') : 'No method connected'}
          icon={LockIcon}
        />
        <SettingsRow
          href="/account/settings/notifications"
          label="Notifications and display"
          value={`${on} of ${switches.length} switched on`}
          icon={BellIcon}
        />
      </SettingsGroup>

      <SettingsGroup title="Privacy and data">
        <SettingsRow
          href="/account/settings/privacy"
          label="Privacy and your data"
          value={blocked.length > 0 ? `${blocked.length} blocked` : 'Nobody blocked'}
          icon={ShieldIcon}
        />
        <SettingsRow
          href="/account/reports"
          label="Your reports"
          value={reports.length > 0 ? `${reports.length} sent` : 'None sent'}
          icon={FlagIcon}
        />
      </SettingsGroup>

      <SettingsGroup title="Selling on ServEm">
        <SettingsRow
          href="/servmate"
          label="ServMate console"
          value={servmate ? 'Your profile, listings and requests' : 'Not set up yet'}
          icon={DocketIcon}
        />
        <SettingsRow
          href="/account/settings/selling"
          label="Verification and payouts"
          value="Neither connected yet"
          icon={BagIcon}
        />
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingsRow
          href="/terms"
          label="Terms and conditions"
          value="How bookings and complaints are handled"
          icon={DocketIcon}
        />
        <SettingsRow
          href="/account/settings/about"
          label="This device"
          value="Local development build"
          icon={DeviceIcon}
        />
      </SettingsGroup>
    </div>
  );
}

function providerLabel(provider: string): string {
  return provider === 'google' ? 'Google' : provider === 'apple' ? 'Apple' : provider;
}

function initialFor(value: string): string {
  const first = Array.from(value.trim())[0];
  return first ? first.toLocaleUpperCase() : 'S';
}
