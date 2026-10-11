import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DeviceDataPanel } from '@/app/components/settings/device-data';
import { PreferencesForm } from '@/app/components/settings/preferences-form';
import { OtherDevicesPanel, PasswordForm } from '@/app/components/settings/security-forms';
import { getPreferences } from '@/lib/account';
import { getSessionProfile } from '@/lib/auth';
import { formatDay } from '@/lib/format';
import { MESSAGE_MAX } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Settings — ServEm',
};

/**
 * Account settings.
 *
 * Organised by what a person is trying to change, not by how the system is
 * built. Where a setting depends on a decision the blueprint has not made —
 * changing an email, deleting an account, moving money — the row says so and
 * offers no control, rather than a button that does nothing.
 */
export default async function SettingsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/?signin=1');

  const preferences = await getPreferences(profile.id);

  return (
    <div className="account-page">
      <PreferencesForm initial={preferences} />

      <section className="account-section" aria-labelledby="set-security">
        <div className="account-section-head">
          <h2 id="set-security">Security</h2>
        </div>
        <PasswordForm hasPassword={profile.hasPassword} />
        <div className="set-rows">
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">Other devices</span>
              <span className="set-row-note">
                Ends every session for this account except the browser you are using now.
              </span>
            </div>
            <div className="set-row-control">
              <OtherDevicesPanel />
            </div>
          </div>
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">Two-factor authentication</span>
              <span className="set-row-note">
                Waiting on the identity-provider decision. Until then, sign-in is a password or a
                Google/Apple account.
              </span>
            </div>
            <div className="set-row-control">
              <span className="set-gate">Not enabled</span>
            </div>
          </div>
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">Sign-in activity</span>
              <span className="set-row-note">
                Sessions are stored with an expiry but no device list, so there is nothing honest to
                show here yet.
              </span>
            </div>
            <div className="set-row-control">
              <span className="set-gate">Not recorded</span>
            </div>
          </div>
        </div>
      </section>

      <section className="account-section" aria-labelledby="set-privacy">
        <div className="account-section-head">
          <h2 id="set-privacy">Privacy and data</h2>
        </div>
        <div className="set-rows">
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">What ServEm stores about you</span>
              <span className="set-row-note">
                Your name, email, a scrypt password hash (or your Google/Apple link), your
                preferences, the requests you send with their messages, and a sign-in cookie. No
                card details, no precise location, no address book.
              </span>
            </div>
          </div>
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">What ServMates see</span>
              <span className="set-row-note">
                The service, area and message on a request, plus the name on this account. Message
                text is capped at {MESSAGE_MAX.toLocaleString('en-PH')} characters.
              </span>
            </div>
          </div>
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">Download your data</span>
              <span className="set-row-note">
                A JSON file with your account details, preferences, requests and messages.
              </span>
            </div>
            <div className="set-row-control">
              <a className="set-secondary" href="/api/account/export" download>
                Download my data
              </a>
            </div>
          </div>
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">Delete this account</span>
              <span className="set-row-note">
                Retention and deletion rules are an open blueprint decision covering live bookings
                and any settlement records, so deletion is not switched on. Ask support to remove an
                account in the meantime.
              </span>
            </div>
            <div className="set-row-control">
              <span className="set-gate">Not enabled</span>
            </div>
          </div>
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">Terms and conditions</span>
              <span className="set-row-note">
                The agreement between you and ServEm: booking rules, payment, privacy and how
                complaints are handled.
              </span>
            </div>
            <div className="set-row-control">
              <Link className="set-secondary" href="/terms">Read the terms</Link>
            </div>
          </div>
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">This account</span>
              <span className="set-row-note">
                Created {formatDay(profile.createdAt)} · {profile.email}
              </span>
            </div>
            <div className="set-row-control">
              <Link className="quiet-button" href="/account/profile">Profile and sign-in</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="account-section" aria-labelledby="set-device">
        <div className="account-section-head">
          <h2 id="set-device">This device</h2>
        </div>
        <DeviceDataPanel />
      </section>

      <section className="account-section" aria-labelledby="set-servmate">
        <div className="account-section-head">
          <h2 id="set-servmate">Selling on ServEm</h2>
          <span className="preview-tag">Design preview</span>
        </div>
        <div className="set-rows">
          <div className="set-row">
            <div className="set-row-copy">
              <span className="set-row-label">ServMate workbench</span>
              <span className="set-row-note">
                Availability, incoming requests, listings and rates for a sample ServMate. Provider
                accounts, verification and payouts are not open to real accounts yet.
              </span>
            </div>
            <div className="set-row-control">
              <Link className="quiet-button" href="/servmate">Open the workbench</Link>
            </div>
          </div>
        </div>
      </section>

      <p className="account-dev-note">
        Local development build: accounts, requests and preferences are stored on this machine in a
        single unencrypted file, not a production datastore.
      </p>
    </div>
  );
}
