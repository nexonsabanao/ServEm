export type FieldErrors = Record<string, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const NAME_MAX = 80;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;
export const MESSAGE_MAX = 4000;

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function validateName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return 'Enter your name.';
  if (Array.from(name).length > NAME_MAX) return `Keep your name under ${NAME_MAX} characters.`;
  return null;
}

export function validateEmail(raw: string): string | null {
  const email = raw.trim();
  if (!email) return 'Enter your email address.';
  if (email.length > EMAIL_MAX) return 'That email address is too long.';
  if (!EMAIL_PATTERN.test(email)) return 'Enter an email address like name@example.com.';
  return null;
}

export function validatePassword(raw: string): string | null {
  if (!raw) return 'Enter a password.';
  if (raw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (raw.length > PASSWORD_MAX) return 'That password is too long.';
  return null;
}

export function validateMessage(raw: string): string | null {
  const message = raw.trim();
  if (!message) return 'Describe what needs doing.';
  if (message.length > MESSAGE_MAX) return `Keep this under ${MESSAGE_MAX} characters.`;
  return null;
}

export function validateChatMessage(raw: string): string | null {
  const message = raw.trim();
  if (!message) return 'Write a message to your ServMate.';
  if (message.length > MESSAGE_MAX) return `Keep this under ${MESSAGE_MAX} characters.`;
  return null;
}
