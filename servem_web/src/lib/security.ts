const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/g;

export function sanitizeUserText(input: string, maxLength = 2_000) {
  return input
    .replace(CONTROL_CHARACTERS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function validatePasswordStrength(password: string) {
  const checks = {
    length: password.length >= 10,
    number: /\d/.test(password),
    letter: /[A-Za-z]/.test(password),
    case: /[a-z]/.test(password) && /[A-Z]/.test(password),
  };

  return {
    ...checks,
    score: Object.values(checks).filter(Boolean).length,
    accepted: checks.length && checks.number && checks.letter,
  };
}

export function safeInternalRedirect(target: string | null | undefined, fallback = '/app/home') {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
    return fallback;
  }

  try {
    const url = new URL(target, 'https://servem.local');
    return url.origin === 'https://servem.local' ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function isOpaqueFirebaseId(value: string) {
  return /^[A-Za-z0-9_-]{6,128}$/.test(value);
}
