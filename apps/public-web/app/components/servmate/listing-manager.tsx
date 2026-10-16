'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SERVICE_AREAS } from '@/lib/presentation';

/**
 * The ServMate's own service listings (§5.4).
 *
 * A listing is what the public storefront shows, so publishing is a separate act
 * from saving and the two are visibly different here. Editing a price is
 * explicitly labelled as affecting future work only, because it does — an
 * accepted offer carries its own agreed amount and the booking snapshots it.
 */
export type OwnListing = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  pricingModel: 'fixed' | 'quote';
  amountCentavos?: number;
  serviceAreaLabel?: string;
  availability?: string;
  terms?: string;
  publicationStatus: 'draft' | 'published' | 'unpublished';
};

type Fields = {
  title: string;
  description: string;
  categoryId: string;
  pricingModel: 'fixed' | 'quote';
  price: string;
  serviceAreaLabel: string;
  availability: string;
  terms: string;
};

const EMPTY: Fields = {
  title: '',
  description: '',
  categoryId: '',
  pricingModel: 'fixed',
  price: '',
  serviceAreaLabel: '',
  availability: '',
  terms: '',
};

export function ListingManager({
  listings,
  categories,
}: {
  listings: OwnListing[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send(
    path: string,
    method: string,
    body?: Record<string, unknown>,
    onDone?: () => void,
  ) {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(path, {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
        cache: 'no-store',
      });
      const payload: unknown = await response.json().catch(() => null);
      const answer = isRecord(payload) ? payload : {};
      if (!response.ok) {
        setError(typeof answer.message === 'string' ? answer.message : 'That did not go through.');
        return;
      }
      onDone?.();
      router.refresh();
    } catch {
      setError('That did not go through. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  function facts(fields: Fields): Record<string, unknown> {
    return {
      title: fields.title,
      description: fields.description,
      categoryId: fields.categoryId,
      pricingModel: fields.pricingModel,
      ...(fields.pricingModel === 'fixed'
        ? { amountCentavos: Math.round(Number(fields.price || '0') * 100) }
        : {}),
      serviceAreaLabel: fields.serviceAreaLabel,
      availability: fields.availability,
      terms: fields.terms,
    };
  }

  return (
    <div className="listing-manager">
      {error && (
        <p className="job-form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="job-media-hint" role="status">
          {notice}
        </p>
      )}

      {listings.length > 0 ? (
        <ul className="order-list">
          {listings.map((listing) => (
            <li key={listing.id} className="order-row">
              <div className="order-when">
                <strong>{labelFor(listing.publicationStatus)}</strong>
              </div>
              <div className="order-what">
                <span className="order-ref">
                  {categories.find((category) => category.id === listing.categoryId)?.name ?? 'Listing'}
                </span>
                <h3>{listing.title}</h3>
                <p className="order-brief">{listing.description}</p>
                <span className="order-area">
                  {priceLabel(listing)} · {listing.serviceAreaLabel || 'Area not stated'}
                  {listing.availability ? ` · ${listing.availability}` : ''}
                </span>
              </div>
              <div className="order-state">
                <button
                  type="button"
                  className="quiet-button"
                  disabled={pending}
                  onClick={() =>
                    send(
                      `/api/servmate/me/services/${listing.id}/publish`,
                      'POST',
                      { published: listing.publicationStatus !== 'published' },
                      () =>
                        setNotice(
                          listing.publicationStatus === 'published'
                            ? 'Withdrawn from the storefront. It stays here so you can publish it again.'
                            : 'Published. It is on your public page now.',
                        ),
                    )
                  }
                >
                  {listing.publicationStatus === 'published' ? 'Withdraw' : 'Publish'}
                </button>
              </div>
              <div className="order-actions">
                <div className="order-action-group">
                  <button
                    type="button"
                    className="quiet-button"
                    onClick={() => setEditing(editing === listing.id ? null : listing.id)}
                  >
                    {editing === listing.id ? 'Close' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    className="quiet-button"
                    disabled={pending}
                    onClick={() =>
                      send(`/api/servmate/me/services/${listing.id}`, 'DELETE', undefined, () =>
                        setNotice('Listing removed.'),
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editing === listing.id && (
                <div className="order-edit">
                  <ListingFields
                    categories={categories}
                    initial={{
                      title: listing.title,
                      description: listing.description,
                      categoryId: listing.categoryId,
                      pricingModel: listing.pricingModel,
                      price: listing.amountCentavos ? String(listing.amountCentavos / 100) : '',
                      serviceAreaLabel: listing.serviceAreaLabel ?? '',
                      availability: listing.availability ?? '',
                      terms: listing.terms ?? '',
                    }}
                    submitLabel={pending ? 'Saving…' : 'Save changes'}
                    disabled={pending}
                    hint="A price change applies to future offers. Work already booked keeps the amount that was agreed."
                    onSubmit={(fields) =>
                      send(`/api/servmate/me/services/${listing.id}`, 'PATCH', facts(fields), () => {
                        setEditing(null);
                        setNotice('Listing saved.');
                      })
                    }
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="account-empty">
          <span className="account-empty-mark" aria-hidden="true">
            ✳
          </span>
          <h3>No listings yet</h3>
          <p>
            A listing is a service customers can find in the storefront. Matching job posts are
            decided by your categories and areas, not by your listings.
          </p>
        </div>
      )}

      {creating ? (
        <div className="order-edit">
          <ListingFields
            categories={categories}
            initial={EMPTY}
            submitLabel={pending ? 'Creating…' : 'Create draft'}
            disabled={pending}
            hint="Saved as a draft. Publish it when you are ready for customers to see it."
            onSubmit={(fields) =>
              send('/api/servmate/me/services', 'POST', facts(fields), () => {
                setCreating(false);
                setNotice('Draft created. Publish it when you are ready.');
              })
            }
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <div className="job-actions">
          <button type="button" className="button button-primary" onClick={() => setCreating(true)}>
            New listing
          </button>
        </div>
      )}
    </div>
  );
}

function ListingFields({
  categories,
  initial,
  submitLabel,
  disabled,
  hint,
  onSubmit,
  onCancel,
}: {
  categories: { id: string; name: string }[];
  initial: Fields;
  submitLabel: string;
  disabled: boolean;
  hint: string;
  onSubmit: (fields: Fields) => void;
  onCancel?: () => void;
}) {
  const [fields, setFields] = useState<Fields>(initial);

  return (
    <form
      className="job-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(fields);
      }}
    >
      <div className="job-field">
        <label className="job-label">Title</label>
        <input
          className="job-input"
          maxLength={120}
          required
          value={fields.title}
          onChange={(event) => setFields({ ...fields, title: event.target.value })}
        />
      </div>
      <div className="job-field">
        <label className="job-label">What it includes</label>
        <textarea
          className="job-input job-textarea"
          rows={3}
          maxLength={2000}
          required
          value={fields.description}
          onChange={(event) => setFields({ ...fields, description: event.target.value })}
        />
      </div>
      <div className="job-grid">
        <div className="job-field">
          <label className="job-label">Category</label>
          <select
            className="job-input"
            required
            value={fields.categoryId}
            onChange={(event) => setFields({ ...fields, categoryId: event.target.value })}
          >
            <option value="">Pick a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="job-field">
          <label className="job-label">Area</label>
          <select
            className="job-input"
            value={fields.serviceAreaLabel}
            onChange={(event) => setFields({ ...fields, serviceAreaLabel: event.target.value })}
          >
            <option value="">Same as my coverage</option>
            {SERVICE_AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="job-grid">
        <div className="job-field">
          <span className="job-label">Pricing</span>
          <div className="job-radio-row">
            <label className="job-radio">
              <input
                type="radio"
                name="pricingModel"
                checked={fields.pricingModel === 'fixed'}
                onChange={() => setFields({ ...fields, pricingModel: 'fixed' })}
              />
              Fixed price
            </label>
            <label className="job-radio">
              <input
                type="radio"
                name="pricingModel"
                checked={fields.pricingModel === 'quote'}
                onChange={() => setFields({ ...fields, pricingModel: 'quote' })}
              />
              Ask for a quote
            </label>
          </div>
        </div>
        {fields.pricingModel === 'fixed' && (
          <div className="job-field">
            <label className="job-label">Price (₱)</label>
            <input
              className="job-input"
              inputMode="numeric"
              required
              value={fields.price}
              onChange={(event) => setFields({ ...fields, price: event.target.value })}
            />
          </div>
        )}
      </div>
      <div className="job-field">
        <label className="job-label">Availability</label>
        <input
          className="job-input"
          maxLength={60}
          placeholder="Same day · weekdays"
          value={fields.availability}
          onChange={(event) => setFields({ ...fields, availability: event.target.value })}
        />
      </div>
      <div className="job-field">
        <label className="job-label">Terms and exclusions</label>
        <textarea
          className="job-input job-textarea"
          rows={2}
          maxLength={600}
          placeholder="What is not included, or what you need from the customer."
          value={fields.terms}
          onChange={(event) => setFields({ ...fields, terms: event.target.value })}
        />
      </div>
      <p className="job-media-hint">{hint}</p>
      <div className="job-actions">
        <button type="submit" className="button button-primary" disabled={disabled}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="quiet-button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function labelFor(status: OwnListing['publicationStatus']): string {
  if (status === 'published') return 'Live';
  if (status === 'draft') return 'Draft';
  return 'Withdrawn';
}

function priceLabel(listing: OwnListing): string {
  if (listing.pricingModel === 'quote' || listing.amountCentavos === undefined) return 'Ask for a quote';
  return `₱${(listing.amountCentavos / 100).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
