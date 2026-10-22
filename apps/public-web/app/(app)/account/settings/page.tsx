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
import { SignOutButton } from '@/app/components/sign-out-button';
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
 * Settings: one identity card, then four short groups of doors.
 *
 * Every row states its current value, so the page answers "what is it set to"
 * without opening anything, and the groups sit two-up on a wide screen. The
 * prose that used to introduce each area is gone — the row's value is the
 * explanation, and the screen behind it does the rest.
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
    <div className="screen settings-page">
      <header className="settings-hero">
        <span className="settings-hero-avatar" aria-hidden="true">{initialFor(profile.name)}</span>
        <div className="settings-hero-copy">
          <p className="settings-hero-eyebrow">Account</p>
          <h1 className="screen-title">Settings</h1>
          <p className="settings-hero-line">{profile.name} · {profile.email}</p>
        </div>
        <span className="settings-hero-since">Since {formatMonth(profile.createdAt)}</span>
      </header>

      {/*
       * Two independent stacks rather than one grid: a short group should not
       * leave a hole under itself while it waits for the tallest group in its
       * row to finish. Account and Privacy lead, Selling and About follow.
       */}
      <div className="settings-grid">
        <div className="settings-col">
          <SettingsGroup title="Account">
            <SettingsRow
              href="/account/profile"
              label="Profile"
              value={profile.profile.area ? `Area: ${profile.profile.area}` : 'Area not set'}
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
              value={`${on}/${switches.length} on`}
              icon={BellIcon}
            />
          </SettingsGroup>

          <SettingsGroup title="Privacy">
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
        </div>

        <div className="settings-col">
          <SettingsGroup title="Selling">
            <SettingsRow
              href="/servmate"
              label="ServMate console"
              value={servmate ? 'Profile and listings' : 'Set up'}
              icon={DocketIcon}
            />
            <SettingsRow
              href="/account/settings/selling"
              label="Verification and payouts"
              value="Not connected"
              icon={BagIcon}
            />
          </SettingsGroup>

          <SettingsGroup title="About">
            <SettingsRow
              href="/terms"
              label="Terms and conditions"
              value="Booking rules"
              icon={DocketIcon}
            />
            <SettingsRow
              href="/account/settings/about"
              label="This device"
              value="Local build"
              icon={DeviceIcon}
            />
          </SettingsGroup>
        </div>
      </div>

      <div className="settings-foot">
        <SignOutButton className="quiet-button" />
      </div>
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
