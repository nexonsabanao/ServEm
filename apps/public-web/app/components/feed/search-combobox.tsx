'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { SearchIcon } from '@/app/components/icons';
import { clearRecentSearches, readRecentSearches, rememberSearch } from '@/lib/device-store';

type Suggestion = {
  services: { id: string; title: string; area: string }[];
  providers: { id: string; name: string; area: string }[];
};

type Option = {
  key: string;
  label: string;
  hint?: string;
  href: string;
  kind: 'recent' | 'search' | 'service' | 'provider';
};

const EMPTY: Suggestion = { services: [], providers: [] };

/**
 * Search, as a mode rather than a page you have to find.
 *
 * The field in the top bar is a real form, so it still submits without
 * JavaScript; with JavaScript it becomes a combobox: recent terms on focus, live
 * matches as you type, and arrow keys that move through both before Enter
 * commits. Every option is a URL — a service opens its own result, a ServMate
 * their profile, a typed term `/search?q=` (or the public storefront, which owns
 * search when nobody is signed in). Nothing is rendered that cannot be opened.
 *
 * The query shown is the URL's `q`, passed down by the shell, so a reload, a
 * shared link and the back button all agree with the field.
 */
export function SearchCombobox({
  action,
  query,
  placeholder = 'Search services',
}: {
  /** `/search` when signed in, `/` for the public storefront. */
  action: string;
  /** The URL's current `q`, already trimmed by the server. */
  query: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(query);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion>(EMPTY);
  const [active, setActive] = useState(-1);

  useEffect(() => setValue(query), [query]);

  useEffect(() => {
    setRecent(readRecentSearches());
  }, []);

  // Landing on a result URL is the same evidence a submit is: the term was
  // worth keeping. Recents belong to the field, so this is the only place they
  // are written — the search screen no longer keeps a second copy.
  useEffect(() => {
    if (!query) return;
    setRecent(rememberSearch(query));
  }, [query]);

  // Live matches, debounced and aborted. Two characters is the point where a
  // suggestion starts being about what was typed rather than what contains it.
  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) {
      setSuggestions(EMPTY);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (isSuggestion(payload)) setSuggestions(payload);
      } catch {
        // A refused suggestion request leaves the typed term and the search
        // action intact; it is an enhancement, not the way search works.
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value]);

  // A click anywhere else closes the panel; focus stays where the person put it.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const term = value.trim();
  const options: Option[] = [];
  if (term.length === 0) {
    for (const entry of recent.slice(0, 5)) {
      options.push({
        key: `recent:${entry}`,
        label: entry,
        hint: 'Recent',
        href: `${action}?q=${encodeURIComponent(entry)}`,
        kind: 'recent',
      });
    }
  } else {
    options.push({
      key: 'search',
      label: `Search for “${term}”`,
      hint: 'Enter',
      href: `${action}?q=${encodeURIComponent(term)}`,
      kind: 'search',
    });
    for (const service of suggestions.services) {
      options.push({
        key: `service:${service.id}`,
        label: service.title,
        hint: service.area,
        href: `${action}?q=${encodeURIComponent(service.title)}`,
        kind: 'service',
      });
    }
    for (const provider of suggestions.providers) {
      options.push({
        key: `provider:${provider.id}`,
        label: provider.name,
        hint: provider.area,
        href: `/providers/${provider.id}`,
        kind: 'provider',
      });
    }
  }

  function go(href: string) {
    if (term) setRecent(rememberSearch(term));
    setOpen(false);
    setActive(-1);
    router.push(href);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = options[active];
    if (chosen) {
      go(chosen.href);
      return;
    }
    if (!term) return;
    go(`${action}?q=${encodeURIComponent(term)}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (options.length === 0 ? -1 : (current + 1) % options.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive((current) =>
        options.length === 0 ? -1 : (current - 1 + options.length) % options.length,
      );
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  const listVisible = open && options.length > 0;

  return (
    <div className="app-search" ref={rootRef}>
      <form
        className={`app-topsearch${open ? ' is-open' : ''}`}
        action={action}
        method="get"
        role="search"
        onSubmit={submit}
      >
        <span className="app-topsearch-icon" aria-hidden="true">
          <SearchIcon />
        </span>
        <label className="visually-hidden" htmlFor="app-search">
          Search services and ServMates
        </label>
        <input
          id="app-search"
          type="search"
          name="q"
          autoComplete="off"
          maxLength={80}
          value={value}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={listVisible}
          aria-controls="app-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={listVisible && active >= 0 ? `app-search-option-${active}` : undefined}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
        />
      </form>

      {listVisible && (
        <div className="app-search-panel" id="app-search-listbox" role="listbox" aria-label="Search suggestions">
          {options.map((option, index) => (
            <button
              key={option.key}
              id={`app-search-option-${index}`}
              type="button"
              className="app-search-option"
              role="option"
              aria-selected={index === active}
              tabIndex={-1}
              data-kind={option.kind}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => go(option.href)}
              onMouseEnter={() => setActive(index)}
            >
              <span className="app-search-option-label">{option.label}</span>
              {option.hint && <span className="app-search-option-hint">{option.hint}</span>}
            </button>
          ))}
          <div className="app-search-foot">
            {term.length === 0 ? (
              <>
                <span>Recent searches</span>
                <button
                  type="button"
                  className="app-search-clear"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    clearRecentSearches();
                    setRecent([]);
                    setOpen(false);
                  }}
                >
                  Clear
                </button>
              </>
            ) : (
              <span>↑ ↓ to move · Enter to open</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function isSuggestion(value: unknown): value is Suggestion {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.services) && Array.isArray(record.providers);
}
