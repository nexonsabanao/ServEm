import { redirect } from 'next/navigation';
import { ProfileEditor } from '@/app/components/settings/profile-editor';
import { SignOutButton } from '@/app/components/sign-out-button';
import { LocationIcon } from '@/app/components/icons';
import { getSessionProfile } from '@/lib/auth';
import { TONE_SWATCHES } from '@/lib/profile';
import { gradientStyle } from '@/lib/feed-data';

export const dynamic = 'force-dynamic';

/**
 * The customer's own profile.
 *
 * The top panel is the public half — the identity a ServMate sees when a
 * request arrives, rendered in the same letterhead language as a ServMate's own
 * page so the two sides of the marketplace read as one system. The form below
 * edits it, and the preview updates as you type.
 */
export default async function ProfilePage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/?signin=1');

  const methods = [
    {
      key: 'password',
      label: 'Email and password',
      // The address itself lives in Settings; this only reports the method.
      detail: 'The address on this account',
      connected: profile.hasPassword,
    },
    {
      key: 'google',
      label: 'Google',
      detail: 'Sign in with your Google account',
      connected: profile.identities.some((identity) => identity.provider === 'google'),
    },
    {
      key: 'apple',
      label: 'Apple',
      detail: 'Sign in with Apple',
      connected: profile.identities.some((identity) => identity.provider === 'apple'),
    },
  ];

  const tone = TONE_SWATCHES[profile.profile.tone] ?? TONE_SWATCHES.ink;

  return (
    <div className="account-page settings-detail">
      <section className="account-section" aria-labelledby="preview-title">
        <div className="account-section-head">
          <h1 id="preview-title">What ServMates see</h1>
        </div>
        <div className="identity-panel">
          <span
            className="identity-avatar"
            aria-hidden="true"
            style={gradientStyle(tone)}
          >
            {initialFor(profile.name)}
          </span>
          <div className="identity-copy">
            <h3 className="identity-name">{profile.name}</h3>
            <p className="identity-meta">
              {profile.profile.area ? (
                <>
                  <LocationIcon /> {profile.profile.area}
                </>
              ) : (
                <span className="identity-unset">Area not set</span>
              )}
            </p>
            <p className="identity-about">
              {profile.profile.about || 'No description yet — ServMates see the service and area.'}
            </p>
          </div>
        </div>
      </section>

      <section className="account-section" aria-labelledby="edit-title">
        <div className="account-section-head">
          <h2 id="edit-title">Edit profile</h2>
        </div>
        <ProfileEditor initialName={profile.name} initialProfile={profile.profile} />
      </section>

      <section className="account-section" aria-labelledby="methods-title">
        <div className="account-section-head">
          <h2 id="methods-title">How you sign in</h2>
        </div>
        <p className="account-section-lede">
          A method is connected once you have signed in with it.
        </p>
        <ul className="method-list">
          {methods.map((method) => (
            <li key={method.key} data-connected={method.connected}>
              <span className="method-label">{method.label}</span>
              <span className="method-detail">{method.detail}</span>
              <span className="method-stamp">{method.connected ? 'Connected' : 'Not connected'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="account-section" aria-labelledby="session-title">
        <div className="account-section-head">
          <h2 id="session-title">This session</h2>
        </div>
        <div className="session-panel">
          <p>Your requests and account are untouched.</p>
          <SignOutButton className="button button-secondary" />
        </div>
      </section>
    </div>
  );
}

function initialFor(value: string): string {
  const first = Array.from(value.trim())[0];
  return first ? first.toLocaleUpperCase() : 'S';
}
