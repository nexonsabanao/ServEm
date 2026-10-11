'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AREA_OPTIONS,
  SORT_OPTIONS,
  type AccountPreferences,
} from '@/lib/preferences';

/**
 * Every stored preference in one form with one Save.
 *
 * The first two sections change what the app does today (the storefront opens
 * on your area and sort; motion and text size apply to every page). The
 * notification switches record intent only, and the panel says so rather than
 * implying mail is on its way.
 */
export function PreferencesForm({ initial }: { initial: AccountPreferences }) {
  const router = useRouter();
  const [form, setForm] = useState<AccountPreferences>(initial);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);

  function set<K extends keyof AccountPreferences>(key: K, value: AccountPreferences[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(form),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

      if (response.status === 401) {
        setStatus({ tone: 'error', message: 'Your session ended. Sign in again to save this.' });
        return;
      }
      if (!response.ok) {
        setStatus({
          tone: 'error',
          message: typeof body.message === 'string' ? body.message : 'Those preferences could not be saved.',
        });
        return;
      }

      setStatus({ tone: 'ok', message: 'Preferences saved.' });
      // Re-renders the root layout so motion and text size apply immediately.
      router.refresh();
    } catch {
      setStatus({ tone: 'error', message: 'Those preferences could not be saved. Check your connection and try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="set-form" onSubmit={submit}>
      <section className="account-section" aria-labelledby="set-storefront">
        <div className="account-section-head">
          <h2 id="set-storefront">Storefront defaults</h2>
        </div>
        <div className="set-rows">
          <div className="set-row">
            <div className="set-row-copy">
              <label className="set-row-label" htmlFor="pref-area">Area</label>
              <span className="set-row-note">The storefront opens on this area.</span>
            </div>
            <div className="set-row-control">
              <select
                id="pref-area"
                className="set-select"
                value={form.defaultArea}
                onChange={(event) => set('defaultArea', event.target.value)}
              >
                {AREA_OPTIONS.map((area) => (
                  <option key={area} value={area}>
                    {area === 'All' ? 'All of Cavite' : area}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="set-row">
            <div className="set-row-copy">
              <label className="set-row-label" htmlFor="pref-sort">Sort order</label>
              <span className="set-row-note">How services are ordered when you open the storefront.</span>
            </div>
            <div className="set-row-control">
              <select
                id="pref-sort"
                className="set-select"
                value={form.defaultSort}
                onChange={(event) => set('defaultSort', event.target.value as AccountPreferences['defaultSort'])}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="account-section" aria-labelledby="set-notifications">
        <div className="account-section-head">
          <h2 id="set-notifications">Notifications</h2>
          <span className="preview-tag">Delivery not connected</span>
        </div>
        <p className="set-lede">
          ServEm has no mail or push service yet, so nothing is sent today. These switches record
          what you want to hear about, and are kept on your account for when a channel exists.
        </p>
        <div className="set-rows">
          <SwitchRow
            id="notify-replies"
            label="When a ServMate replies"
            note="A reply, a quotation or a changed visit time on one of your requests."
            checked={form.notifyReplies}
            onChange={(value) => set('notifyReplies', value)}
          />
          <SwitchRow
            id="notify-requests"
            label="When a request changes"
            note="Accepted, declined or withdrawn — anything that moves a request forward."
            checked={form.notifyRequestUpdates}
            onChange={(value) => set('notifyRequestUpdates', value)}
          />
          <SwitchRow
            id="notify-product"
            label="Product announcements"
            note="New areas and categories as ServEm opens them up."
            checked={form.notifyProductNews}
            onChange={(value) => set('notifyProductNews', value)}
          />
          <div className="set-channels">
            <Channel name="Email" state="Not connected" />
            <Channel name="Push" state="Not connected" />
            <Channel name="In-app" state="Shown in the top bar" />
          </div>
        </div>
      </section>

      <section className="account-section" aria-labelledby="set-accessibility">
        <div className="account-section-head">
          <h2 id="set-accessibility">Accessibility</h2>
        </div>
        <div className="set-rows">
          <SwitchRow
            id="reduce-motion"
            label="Reduce motion"
            note="Removes hover lifts, card scaling and the loading animations."
            checked={form.reduceMotion}
            onChange={(value) => set('reduceMotion', value)}
          />
          <SwitchRow
            id="larger-text"
            label="Larger text"
            note="Scales every page up by about a tenth."
            checked={form.largerText}
            onChange={(value) => set('largerText', value)}
          />
        </div>
      </section>

      <div className="set-actions">
        <button type="submit" className="set-save" disabled={pending}>
          {pending ? 'Saving…' : 'Save preferences'}
        </button>
        {status && (
          <p className="set-status" data-tone={status.tone} role={status.tone === 'error' ? 'alert' : 'status'}>
            {status.message}
          </p>
        )}
      </div>
    </form>
  );
}

function SwitchRow({
  id,
  label,
  note,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  note: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="set-row">
      <div className="set-row-copy">
        <span className="set-row-label" id={`${id}-label`}>{label}</span>
        <span className="set-row-note">{note}</span>
      </div>
      <div className="set-row-control">
        <button
          type="button"
          id={id}
          className="set-switch"
          role="switch"
          aria-checked={checked}
          aria-labelledby={`${id}-label`}
          onClick={() => onChange(!checked)}
        >
          <span className="set-switch-track" aria-hidden="true"><span className="set-switch-thumb" /></span>
          <span className="set-switch-state">{checked ? 'On' : 'Off'}</span>
        </button>
      </div>
    </div>
  );
}

function Channel({ name, state }: { name: string; state: string }) {
  return (
    <span className="set-channel">
      <span className="set-channel-name">{name}</span>
      <span className="set-channel-state">{state}</span>
    </span>
  );
}
