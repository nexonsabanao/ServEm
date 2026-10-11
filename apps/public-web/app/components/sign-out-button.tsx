'use client';

import { useState } from 'react';

export function SignOutButton({
  className = 'quiet-button',
  label = 'Sign out',
}: {
  className?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' });
    } catch {
      // The cookie is cleared on the next successful call either way.
    }
    window.location.assign('/');
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => void signOut()}
      disabled={pending}
    >
      {pending ? 'Signing out…' : label}
    </button>
  );
}
