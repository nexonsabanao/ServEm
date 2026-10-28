import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BriefcaseBusiness, Check, UserRound } from 'lucide-react';
import { AuthHeader } from '../components/SiteHeader';
import { Button, Chip, Field, Logo, TextInput } from '../components/ui';
import { useApp } from '../state/AppState';
import { friendlyAuthError, isEmailVerifiedNow, sendVerificationEmail } from '../lib/firebase';
import { safeInternalRedirect } from '../lib/security';

function AuthSplit({ children, below }: { children: React.ReactNode; below?: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--color-page)]">
      <AuthHeader />
      <main className="shell-width auth-split">
        <div className="auth-story">
          <img
            src="/assets/photos/hero_welcome.jpg"
            alt="A ServMate assembling a wooden cabinet in a sunlit living room"
            className="w-full rounded-[14px] object-cover"
          />
          <p className="mt-8 max-w-[500px] text-[27px] font-semibold leading-[1.28] tracking-[-0.02em] text-[var(--color-brand-deep)]">
            Good people. Everyday tasks, taken care of.
          </p>
          <p className="mt-5 max-w-[420px] text-[13px] leading-[1.7] text-[var(--color-muted)]">
            A helping hand, close to home. Find trusted local help or share your skills with your neighborhood.
          </p>
          <p className="mt-6 text-[12px] text-[var(--color-muted-2)]">Local skills. A little peace of mind.</p>
        </div>
        <div className="auth-content">{children}</div>
        {below ? <div className="col-span-full mt-4">{below}</div> : null}
      </main>
    </div>
  );
}

function SocialButtons({
  onGoogle,
  onApple,
  busy,
}: {
  onGoogle: () => void;
  onApple: () => void;
  busy: 'google' | 'apple' | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
      <Button variant="ghost" pill onClick={onGoogle} type="button" disabled={busy !== null}>
        <GoogleGlyph /> {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
      </Button>
      <Button variant="ghost" pill onClick={onApple} type="button" disabled={busy !== null}>
        <AppleGlyph /> {busy === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}
      </Button>
    </div>
  );
}

function AppleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.37 1.43c0 1.14-.42 2.2-1.26 3.06-.84.86-1.94 1.35-3.05 1.26-.05-1.1.36-2.18 1.2-3.02.85-.86 2.03-1.34 3.11-1.3ZM20.5 17.2c-.55 1.27-.82 1.84-1.53 2.96-1 1.56-2.4 3.5-4.14 3.51-1.55.02-1.95-1.01-4.05-1-2.1.01-2.54 1.02-4.09 1-1.74-.01-3.07-1.77-4.07-3.33C-.2 16.6-.5 11.9 1.2 9.44c1.2-1.74 3.1-2.76 4.88-2.76 1.82 0 2.96 1 4.46 1 1.46 0 2.35-1 4.45-1 1.58 0 3.26.86 4.45 2.35-3.9 2.14-3.27 7.72 1.06 8.17Z" />
    </svg>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
      />
      <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" />
      <path
        fill="#EA4335"
        d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z"
      />
    </svg>
  );
}

export function SignupPage() {
  const { signUp, signInGoogle, signInApple, authBusy, authError } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [socialBusy, setSocialBusy] = useState<'google' | 'apple' | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeInternalRedirect(params.get('next'));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    if (!accepted) {
      setLocalError('Please accept the Terms and Privacy Policy to continue.');
      return;
    }
    if (password.length < 8) {
      setLocalError('Use at least 8 characters, including a number.');
      return;
    }
    if (password !== confirm) {
      setLocalError('Passwords do not match.');
      return;
    }
    const ok = await signUp(name, email, password);
    if (ok) navigate('/verify');
  };

  return (
    <AuthSplit>
      <Chip>Your neighborhood, in one place</Chip>
      <h1 className="mt-4 text-[25px] font-semibold tracking-[-0.02em]">Create your account</h1>
      <p className="mt-2 text-[13px] text-[var(--color-muted)]">A little help starts here. Join your neighborhood.</p>
      <form className="mt-7 flex max-w-[475px] flex-col gap-4" onSubmit={submit}>
        <TextInput label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        <TextInput
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <TextInput
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          hint="Use at least 8 characters, including a number."
          required
        />
        <TextInput
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        <label className="mt-1 flex items-start gap-3 text-[12px] leading-[1.6] text-[var(--color-muted)]">
          <input
            type="checkbox"
            className="mt-0.5 h-[16px] w-[16px] shrink-0 accent-[var(--color-brand)]"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" target="_blank" className="text-[var(--color-brand)]">
              Terms and Conditions
            </Link>{' '}
            and{' '}
            <Link to="/privacy" target="_blank" className="text-[var(--color-brand)]">
              Privacy Policy
            </Link>
            , and I consent to the processing of my personal data as described there.
          </span>
        </label>
        {localError || authError ? (
          <p className="text-[12px] text-[var(--color-danger)]" role="alert">
            {localError ?? authError}
          </p>
        ) : null}
        <Button type="submit" pill disabled={authBusy} className="mt-1">
          {authBusy ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="text-[11.5px] leading-[1.6] text-[var(--color-muted-2)]">
          ServEm operates in the Philippines. Personal data is processed under the Data Privacy Act of 2012
          (RA 10173); see our Privacy Policy for your rights.
        </p>
      </form>
      <div className="mt-3 max-w-[475px]">
        <SocialButtons
          busy={socialBusy}
          onGoogle={async () => {
            setSocialBusy('google');
            const ok = await signInGoogle();
            setSocialBusy(null);
            if (ok) navigate(next);
          }}
          onApple={async () => {
            setSocialBusy('apple');
            const ok = await signInApple();
            setSocialBusy(null);
            if (ok) navigate(next);
          }}
        />
      </div>
    </AuthSplit>
  );
}

export function LoginPage() {
  const { signIn, signInGoogle, signInApple, authBusy, authError } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [socialBusy, setSocialBusy] = useState<'google' | 'apple' | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeInternalRedirect(params.get('next'));

  return (
    <AuthSplit>
      <h1 className="mt-4 text-[25px] font-semibold tracking-[-0.02em]">Welcome back</h1>
      <p className="mt-2 text-[13px] text-[var(--color-muted)]">
        A helping hand is close by. Sign in with the email you used to create your account.
      </p>
      <form
        className="mt-7 flex max-w-[475px] flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const ok = await signIn(email, password);
          if (ok) navigate(next);
        }}
      >
        <TextInput label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <Field>
          <label className="label">Password</label>
          <div className="relative">
            <input
              className="field pr-16"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Link
              to="/reset"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-[var(--color-brand)]"
            >
              Forgot?
            </Link>
          </div>
        </Field>
        {authError ? <p className="text-[12px] text-[var(--color-danger)]">{authError}</p> : null}
        <Button type="submit" pill disabled={authBusy}>
          {authBusy ? 'Signing in…' : 'Log In'}
        </Button>
      </form>
      <div className="mt-3 max-w-[475px]">
        <SocialButtons
          busy={socialBusy}
          onGoogle={async () => {
            setSocialBusy('google');
            const ok = await signInGoogle();
            setSocialBusy(null);
            if (ok) navigate(next);
          }}
          onApple={async () => {
            setSocialBusy('apple');
            const ok = await signInApple();
            setSocialBusy(null);
            if (ok) navigate(next);
          }}
        />
      </div>
      <p className="mt-6 max-w-[475px] text-[11.5px] leading-[1.6] text-[var(--color-muted-2)]">
        By logging in, you agree to our{' '}
        <Link to="/terms" target="_blank" className="text-[var(--color-brand)]">
          Terms and Conditions
        </Link>{' '}
        and{' '}
        <Link to="/privacy" target="_blank" className="text-[var(--color-brand)]">
          Privacy Policy
        </Link>
        . New to ServEm?{' '}
        <Link to="/signup" className="text-[var(--color-brand)]">
          Create an account
        </Link>
        .
      </p>
    </AuthSplit>
  );
}

export function ResetPasswordPage() {
  const { requestPasswordReset, authBusy, authError } = useApp();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <AuthSplit>
      <Chip>Your neighborhood, in one place</Chip>
      <h1 className="mt-4 text-[25px] font-semibold tracking-[-0.02em]">Reset your password</h1>
      <p className="mt-2 max-w-[440px] text-[13px] leading-[1.7] text-[var(--color-muted)]">
        Enter the email you used to create your account and we’ll send a secure reset link. It expires after 30 minutes.
      </p>
      {sent ? (
        <div className="mt-8 max-w-[475px] rounded-[12px] bg-[var(--color-soft)] p-4 text-[13px] text-[#2e5a46]">
          <p className="flex items-center gap-2 font-medium">
            <Check size={15} /> Reset link sent
          </p>
          <p className="mt-1">
            Check <strong>{email}</strong> for the link. It expires after 30 minutes — if it hasn’t arrived,
            look in your spam folder or request another.
          </p>
          <Link to="/login" className="mt-3 inline-block text-[12px] text-[var(--color-brand)]">
            ← Back to log in
          </Link>
        </div>
      ) : (
        <form
          className="mt-8 flex max-w-[475px] flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await requestPasswordReset(email);
            if (ok) setSent(true);
          }}
        >
          <TextInput label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {authError ? <p className="text-[12px] text-[var(--color-danger)]">{authError}</p> : null}
          <Button type="submit" pill disabled={authBusy}>
            {authBusy ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
      <p className="mt-6 max-w-[475px] text-[11.5px] leading-[1.6] text-[var(--color-muted-2)]">
        Remembered it? <Link to="/login" className="text-[var(--color-brand)]">Log in</Link>.
      </p>
    </AuthSplit>
  );
}

export function VerifyPage() {
  const { user, refresh } = useApp();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const verified = Boolean(user?.emailVerified);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();
      if (result) setNotice(result);
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <AuthSplit>
        <Chip>Your neighborhood, in one place</Chip>
        <h1 className="mt-4 text-[25px] font-semibold tracking-[-0.02em]">Sign in to continue</h1>
        <p className="mt-2 max-w-[440px] text-[13px] leading-[1.7] text-[var(--color-muted)]">
          Your session ended before the email was confirmed. Log in again and we’ll pick up from here.
        </p>
        <div className="mt-6 flex max-w-[475px] flex-col gap-3">
          <Link to="/login" className="btn btn-primary btn-pill btn-block">
            Log in
          </Link>
          <Link to="/signup" className="btn btn-ghost btn-pill btn-block">
            Create an account
          </Link>
        </div>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit>
      <Chip>Your neighborhood, in one place</Chip>
      <h1 className="mt-4 text-[25px] font-semibold tracking-[-0.02em]">Confirm your email</h1>
      <p className="mt-2 max-w-[440px] text-[13px] leading-[1.7] text-[var(--color-muted)]">
        We send a private link to <strong>{user.email}</strong>. Confirming it protects your account and lets
        ServEm book jobs in your name.
      </p>
      <div
        className={`mt-6 max-w-[475px] rounded-[12px] p-4 text-[13px] ${
          verified ? 'bg-[var(--color-soft)] text-[#2e5a46]' : 'bg-[var(--color-page)] text-[var(--color-muted)]'
        }`}
        role="status"
        aria-live="polite"
      >
        <p className="flex items-center gap-2 font-medium">
          {verified ? <Check size={15} /> : null}
          {verified ? 'Email confirmed' : 'Waiting for your confirmation'}
        </p>
        <p className="mt-1">
          {verified
            ? 'You can move on to set up your ServEm profile.'
            : 'Open the email and click the link. It expires after 30 minutes, and you can ask for a new one anytime.'}
        </p>
        {notice ? <p className="mt-2 text-[12px] text-[var(--color-danger)]">{notice}</p> : null}
      </div>
      <div className="mt-6 flex max-w-[475px] flex-col gap-3">
        {verified ? (
          <Button pill onClick={() => navigate('/role')}>
            Continue
          </Button>
        ) : (
          <>
            <Button
              pill
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  try {
                    await sendVerificationEmail();
                    return 'Verification email sent. Click the link it contains, then check back here.';
                  } catch (reason) {
                    return friendlyAuthError(reason);
                  }
                })
              }
            >
              {busy ? 'Sending…' : 'Send verification email'}
            </Button>
            <Button
              variant="ghost"
              pill
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  try {
                    if (await isEmailVerifiedNow()) {
                      refresh();
                      navigate('/role');
                      return null;
                    }
                    return "We haven't seen the confirmation yet. Click the link in the email, then check again.";
                  } catch (reason) {
                    return friendlyAuthError(reason);
                  }
                })
              }
            >
              I’ve confirmed my email
            </Button>
          </>
        )}
      </div>
      <p className="mt-6 max-w-[475px] text-[11.5px] leading-[1.6] text-[var(--color-muted-2)]">
        Wrong address?{' '}
        <Link to="/app/profile" className="text-[var(--color-brand)]">
          Update your email
        </Link>{' '}
        and confirm again.
      </p>
    </AuthSplit>
  );
}

export function RoleSelectPage() {
  const [role, setRole] = useState<'customer' | 'servmate'>('customer');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get('next');

  return (
    <AuthSplit>
      <Chip>Your neighborhood, in one place</Chip>
      <h1 className="mt-4 text-[25px] font-semibold tracking-[-0.02em]">How can we help?</h1>
      <h2 className="mt-5 text-[17px] font-medium">Find help. Or lend a hand.</h2>
      <p className="mt-2 max-w-[440px] text-[13px] leading-[1.7] text-[var(--color-muted)]">
        Choose how you’d like to start. You can switch roles in your profile anytime.
      </p>
      <div className="mt-6 flex max-w-[475px] flex-col gap-3">
        {[
          {
            id: 'customer' as const,
            icon: <UserRound size={17} />,
            title: 'I’m a customer',
            body: 'Find trusted local help for everyday tasks.',
          },
          {
            id: 'servmate' as const,
            icon: <BriefcaseBusiness size={17} />,
            title: 'I’m a ServMate',
            body: 'Share your skills and earn on your schedule.',
          },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setRole(option.id)}
            className={`flex items-start gap-3 rounded-[12px] px-4 py-3.5 text-left transition-colors ${
              role === option.id
                ? 'border border-[var(--color-brand)] bg-[var(--color-soft)]'
                : 'border border-[var(--color-line)] bg-white'
            }`}
            aria-pressed={role === option.id}
          >
            <span
              className={`mt-0.5 grid h-7 w-7 place-items-center rounded-full ${
                role === option.id ? 'bg-[var(--color-brand)] text-white' : 'bg-[var(--color-page)] text-[var(--color-muted)]'
              }`}
            >
              {option.icon}
            </span>
            <span>
              <span className="block text-[13.5px] font-medium">{option.title}</span>
              <span className="mt-0.5 block text-[12px] text-[var(--color-muted)]">{option.body}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="tip mt-4 max-w-[475px]">
        <p className="font-medium">One account, two ways to use ServEm</p>
        <p className="mt-1">
          Booking help and ServMate jobs stay separate, and you can switch between them anytime from your
          profile.
        </p>
      </div>
      <div className="mt-4 max-w-[475px]">
        <Button
          pill
          block
          onClick={() =>
            navigate(requested ? safeInternalRedirect(requested) : role === 'customer' ? '/app/home' : '/mate')
          }
        >
          Continue as {role === 'customer' ? 'customer' : 'ServMate'}
        </Button>
      </div>
      <p className="mt-6 text-[11.5px] text-[var(--color-muted-2)]">
        <Link to="/" className="text-[var(--color-brand)]">
          ← Back
        </Link>{' '}
        · ServMates confirm an ID and a phone number before their first paid job.
      </p>
    </AuthSplit>
  );
}

export function AuthFooter() {
  return (
    <div className="flex items-center justify-between border-t border-[var(--color-line)] py-5 text-[11.5px] text-[var(--color-muted-2)]">
      <Logo />
      <span>Local skills. A little peace of mind.</span>
    </div>
  );
}
