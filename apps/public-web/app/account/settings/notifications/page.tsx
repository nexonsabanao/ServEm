import { redirect } from 'next/navigation';
import { PreferencesForm } from '@/app/components/settings/preferences-form';
import { SettingsScreen } from '@/app/components/settings/settings-screen';
import { getPreferences } from '@/lib/account';
import { getSessionProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Notifications and display — ServEm',
};

/** Every stored preference, on one screen with one Save. */
export default async function NotificationSettingsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/?signin=1');

  const preferences = await getPreferences(profile.id);

  return (
    <SettingsScreen
      title="Notifications and display"
      sub="What ServEm tells you about, the defaults the storefront opens with, and how the app looks."
    >
      <PreferencesForm initial={preferences} />
    </SettingsScreen>
  );
}
