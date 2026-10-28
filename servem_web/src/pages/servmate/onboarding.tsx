import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, UserRound } from 'lucide-react';
import {
  Avatar,
  Button,
  Callout,
  Card,
  Chip,
  FooterNote,
  LinkButton,
  MapSketch,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from '../../components/ui';
import { MonthCalendar, manilaToday } from '../../components/Calendar';
import {
  VERIFICATION_TYPES,
  callableErrorMessage,
  submitVerification,
  verificationTypeLabels,
  type VerificationType,
} from '../../lib/functions';
import {
  uploadVerificationDocument,
  verificationFileProblem,
} from '../../lib/storage';
import { Toggle } from '../../components/Toggle';
import { fetchOwnServmate, saveServmateProfile } from '../../lib/db';
import { saveService } from '../../lib/functions';
import { uploadListingPhoto } from '../../lib/storage';
import { useApp } from '../../state/AppState';

export function BecomeServMatePage() {
  return (
    <>
      <PageHeader title="Become a ServMate" subtitle="Your skills. Your neighborhood. Your schedule." />
      <img
        src="/assets/photos/hero_welcome.jpg"
        alt="A ServMate assembling furniture"
        className="mt-5 h-[240px] w-full rounded-[14px] object-cover"
      />
      <h2 className="mt-6 text-[25px] font-semibold tracking-[-0.02em]">Your skills. Someone’s day made.</h2>
      <p className="mt-2 text-[13px] text-[var(--color-muted)]">
        Careful fixes, kind service. Set your hours, and make everyday life a little easier.
      </p>

      <div className="mt-5 flex items-start gap-3 rounded-[12px] border border-[var(--color-brand)] bg-[var(--color-soft)] px-4 py-3.5">
        <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-white text-[var(--color-brand-deep)]">
          <UserRound size={15} />
        </span>
        <div>
          <p className="text-[13px] font-medium">Set up as an individual</p>
          <p className="mt-0.5 text-[12px] text-[#3e5a4e]">Offer help as a neighborhood ServMate.</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <Link to="/mate/verify" className="flex items-start gap-2 text-[13px] font-medium">
          Build your profile <ArrowRight size={14} className="mt-0.5 text-[var(--color-brand)]" />
        </Link>
        <p className="-mt-2 text-[12px] text-[var(--color-muted)]">Show customers what you do best</p>
        <Link to="/mate/services" className="flex items-start gap-2 text-[13px] font-medium">
          Add your services <ArrowRight size={14} className="mt-0.5 text-[var(--color-brand)]" />
        </Link>
        <p className="-mt-2 text-[12px] text-[var(--color-muted)]">Choose prices, hours and service area</p>
      </div>

      <LinkButton to="/mate/apply" block className="mt-5">
        Start ServMate setup
      </LinkButton>
      <FooterNote />
    </>
  );
}

export function ApplicationPage() {
  const { profile, user } = useApp();
  const [name, setName] = useState(profile.name);
  const [area, setArea] = useState(profile.city);
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [availability, setAvailability] = useState('Flexible');
  const [tools, setTools] = useState(true);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const allSkills = ['Furniture assembly', 'Home cleaning', 'Small repairs', 'Errands', 'Tech help', 'Yard & garden'];

  const advance = async () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    if (!user) {
      setError('Sign in again before saving your setup.');
      return;
    }
    if (name.trim().length < 2) {
      setError('Add a display name so customers know who they booked.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveServmateProfile(user.uid, {
        name,
        bio,
        area: area.trim() || profile.city,
        skills,
        available: true,
        availability,
        tools,
      });
      navigate('/mate/verify');
    } catch (reason) {
      setError(callableErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Tell your neighborhood" subtitle="A few details so neighbors know what you do best." />
      <div className="mt-5 grid grid-cols-[1fr_240px] gap-6 max-lg:grid-cols-1">
        <div>
          <Card className="p-5">
            <h2 className="card-title">About you</h2>
            <div className="mt-3 grid grid-cols-2 gap-4 max-lg:grid-cols-1">
              <TextInput label="Full name" value={name} onChange={(event) => setName(event.target.value)} />
              <TextInput label="Email address" value={profile.email} readOnly />
              <TextInput label="Phone number" value={profile.phone} readOnly />
              <TextInput
                label="Neighborhood"
                value={area}
                onChange={(event) => setArea(event.target.value)}
                placeholder="Barangay, city"
              />
            </div>
            <div className="mt-3">
              <TextArea
                label="A short introduction"
                rows={3}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="What do you do best? Share your tools, experience and how you work."
              />
            </div>
            <p className="label mt-4">Skills</p>
            <div className="flex flex-wrap gap-2">
              {allSkills.map((skill) => {
                const active = skills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => setSkills(active ? skills.filter((s) => s !== skill) : [...skills, skill])}
                    className={`rounded-full border px-3 py-1.5 text-[12px] ${
                      active
                        ? 'border-[var(--color-brand)] bg-[var(--color-soft)] text-[var(--color-brand-deep)]'
                        : 'border-[var(--color-line)] bg-white text-[var(--color-muted)]'
                    }`}
                    aria-pressed={active}
                  >
                    {active ? '✓ ' : ''}
                    {skill}
                  </button>
                );
              })}
            </div>
            <div className="mt-3">
              <Select label="Availability" value={availability} onChange={(e) => setAvailability(e.target.value)}>
                <option>Weeknights & weekends</option>
                <option>Weekdays</option>
                <option>Flexible</option>
              </Select>
            </div>
            <label className="mt-4 flex items-center gap-2 text-[12.5px] text-[var(--color-muted)]">
              <input
                type="checkbox"
                checked={tools}
                onChange={(event) => setTools(event.target.checked)}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              I have my own tools and transport
            </label>
            {error ? (
              <p className="mt-3 text-[12px] text-[var(--color-danger)]" role="alert">
                {error}
              </p>
            ) : null}
            <Button block className="mt-4" disabled={busy} onClick={() => void advance()}>
              {busy ? 'Saving…' : 'Continue'}
            </Button>
          </Card>
          <div className="tip mt-4">
            <p className="font-medium">What happens next</p>
            <p className="mt-1">Profile · Services · Availability · Verification. You can revisit each step.</p>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="text-[14px] font-medium">Your ServMate setup</h2>
            <div className="mt-2 space-y-1 text-[12.5px] text-[var(--color-muted)]">
              {[
                ['1 · Profile', step === 1],
                ['2 · Services', step === 2],
                ['3 · Availability', step === 3],
                ['4 · Verification', false],
              ].map(([label, current]) => (
                <p key={String(label)} className={current ? 'font-medium text-[var(--color-ink)]' : ''}>
                  {label} {current ? '· Current' : '→'}
                </p>
              ))}
            </div>
          </Card>
          <Callout title="One account, two roles">
            Your customer bookings and ServMate jobs stay separate. You can switch roles in your profile.
          </Callout>
          <p className="text-[11px] leading-[1.6] text-[var(--color-muted-2)]">
            Payments are arranged with your ServMate once a job is accepted. Document checks open before your first paid job.
          </p>
        </aside>
      </div>
      <FooterNote />
    </>
  );
}

export function VerificationPage() {
  const { user } = useApp();
  const [files, setFiles] = useState<File[]>([]);
  const [type, setType] = useState<VerificationType>('government_id');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const addFiles = (picked: FileList | null) => {
    if (!picked) return;
    setError(null);
    const next = [...files];
    for (const file of Array.from(picked)) {
      const problem = verificationFileProblem(file);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        continue;
      }
      if (next.length >= 5) {
        setError('You can send up to 5 files. Remove one to add another.');
        break;
      }
      if (!next.some((item) => item.name === file.name && item.size === file.size)) next.push(file);
    }
    setFiles(next);
  };

  const submit = async () => {
    setError(null);
    if (!user) {
      setError('Please sign in again before sending documents.');
      return;
    }
    if (files.length === 0) {
      setError('Choose at least one document to send.');
      return;
    }
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const file of files) {
        paths.push(await uploadVerificationDocument(user.uid, file));
      }
      await submitVerification({ documentPaths: paths, type });
      setSubmitted(true);
      setFiles([]);
    } catch (reason) {
      setError(callableErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <>
        <PageHeader title="Verification" subtitle="A safe neighborhood starts with trust." />
        <Card className="mt-5 max-w-[560px] p-6">
          <p className="flex items-center gap-2 text-[15px] font-medium text-[var(--color-brand-deep)]">
            <Check size={16} /> Sent for review
          </p>
          <p className="mt-2 text-[13px] leading-[1.7] text-[var(--color-muted)]">
            Your documents are stored privately. A reviewer checks them before your first paid job, and
            customers only ever see that your account is verified — never the files.
          </p>
          <div className="mt-4 flex gap-3">
            <LinkButton to="/mate/services" variant="ghost">
              Back to services
            </LinkButton>
            <Button
              variant="ghost"
              onClick={() => {
                setSubmitted(false);
                setError(null);
              }}
            >
              Send another document
            </Button>
          </div>
        </Card>
        <FooterNote />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Verification" subtitle="A safe neighborhood starts with trust." />
      <div className="mt-5 grid grid-cols-[1fr_240px] gap-6 max-lg:grid-cols-1">
        <div>
          <div className="rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
            <p className="text-[10px] font-semibold tracking-[0.08em] text-[var(--color-brand-deep)]">PRIVATE BY DESIGN</p>
            <p className="mt-1 text-[13px] font-medium text-[var(--color-brand-deep)]">Only reviewers see your documents</p>
            <p className="mt-1 text-[12px] leading-[1.6] text-[#3e5a4e]">
              Files go to a private bucket tied to your account. Customers see only that you are verified,
              and you can ask for deletion at any time.
            </p>
          </div>

          <Card className="mt-4 p-5">
            <label className="label" htmlFor="verification-document">
              Which document are you sending?
            </label>
            <Select
              id="verification-document"
              value={type}
              onChange={(event) => setType(event.target.value as VerificationType)}
            >
              {VERIFICATION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {verificationTypeLabels[value]}
                </option>
              ))}
            </Select>

            <div className="mt-4">
              <label className="label" htmlFor="verification-files">
                Document photos or PDFs
              </label>
              <input
                id="verification-files"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = '';
                }}
                className="mt-1 block w-full cursor-pointer rounded-[10px] border border-[var(--color-line)] bg-white px-3 py-2.5 text-[12.5px] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--color-soft)] file:px-3 file:py-1.5 file:text-[12px] file:text-[var(--color-brand-deep)]"
              />
              <p className="mt-1.5 text-[11.5px] text-[var(--color-muted-2)]">
                JPG, PNG, WebP or PDF · up to 8 MB each · up to 5 files
              </p>
            </div>

            {files.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {files.map((file) => (
                  <li
                    key={`${file.name}-${file.size}`}
                    className="flex items-center justify-between gap-3 rounded-[8px] bg-[var(--color-page)] px-3 py-2 text-[12.5px]"
                  >
                    <span className="min-w-0 truncate">{file.name}</span>
                    <span className="flex shrink-0 items-center gap-3 text-[11.5px] text-[var(--color-muted)]">
                      {Math.max(1, Math.round(file.size / 1024))} KB
                      <button
                        type="button"
                        onClick={() => setFiles(files.filter((item) => item !== file))}
                        className="text-[var(--color-danger)]"
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {error ? (
              <p className="mt-3 text-[12px] text-[var(--color-danger)]" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              block
              className="mt-4"
              onClick={() => void submit()}
              disabled={busy || files.length === 0}
            >
              {busy ? 'Sending…' : 'Send for review'}
            </Button>
          </Card>

          <p className="mt-3 text-[11.5px] leading-[1.6] text-[var(--color-muted-2)]">
            By sending documents you confirm they are yours and may be checked against public records.
            Read the{' '}
            <Link to="/privacy" target="_blank" className="text-[var(--color-brand)]">
              Privacy Policy
            </Link>{' '}
            for how long they are kept.
          </p>
        </div>
        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="card-title">Your ServMate setup</h2>
            <div className="mt-2 space-y-1 text-[12.5px] text-[var(--color-muted)]">
              <p>1 · Profile →</p>
              <p>2 · Services →</p>
              <p>3 · Availability →</p>
              <p className="font-medium text-[var(--color-ink)]">4 · Verification</p>
            </div>
          </Card>
          <Callout title="A little privacy, by design">
            Only the verification state is shown to customers — never the documents themselves.
          </Callout>
          <p className="text-[11px] leading-[1.6] text-[var(--color-muted-2)]">
            Payments are arranged with your ServMate once a job is accepted. Document checks open before
            your first paid job.
          </p>
        </aside>
      </div>
      <FooterNote />
    </>
  );
}

export function PublicProfilePage() {
  const { user, profile } = useApp();
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState('');
  const [area, setArea] = useState(profile.city);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState('');
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchOwnServmate(user.uid)
      .then((row) => {
        if (!alive || !row) return;
        setName(String(row['name'] ?? profile.name));
        setBio(String(row['bio'] ?? ''));
        setArea(String(row['area'] ?? profile.city));
        setSkills(Array.isArray(row['skills']) ? (row['skills'] as string[]) : []);
        setAvailable(row['status'] !== 'paused');
      })
      .catch((reason) => {
        if (!alive) return;
        setFailed(true);
        setMessage(reason instanceof Error ? reason.message : 'Could not load your profile.');
      });
    return () => {
      alive = false;
    };
  }, [user, profile.name, profile.city]);

  const save = async () => {
    if (!user) {
      setFailed(true);
      setMessage('Sign in again before saving.');
      return;
    }
    if (name.trim().length < 2) {
      setFailed(true);
      setMessage('Add a display name so customers know who they booked.');
      return;
    }
    setBusy(true);
    setMessage(null);
    setFailed(false);
    try {
      await saveServmateProfile(user.uid, { name, bio, area, skills, available });
      setMessage('Saved to your public profile.');
    } catch (reason) {
      setFailed(true);
      setMessage(callableErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Your public profile" subtitle="How neighbors see you." />
      <div className="mt-5 grid grid-cols-[1fr_240px] gap-6 max-lg:grid-cols-1">
        <div>
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <Avatar src={profile.photo} name={name || profile.name} size={56} />
              <div>
                <p className="text-[15px] font-medium">{name || 'Your name'}</p>
                <p className="text-[12px] text-[var(--color-muted)]">
                  {area.trim() || profile.city || 'Add your neighborhood'}
                </p>
              </div>
              <Chip small className="ml-auto">
                ServMate profile
              </Chip>
            </div>
            <div className="mt-4 space-y-3">
              <TextInput
                label="Display name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
              <TextArea
                label="About you"
                rows={3}
                value={bio}
                placeholder="What do you do well, and what should a customer know before booking?"
                onChange={(event) => setBio(event.target.value)}
              />
              <TextInput
                label="Neighborhood"
                value={area}
                onChange={(event) => setArea(event.target.value)}
                hint="Customers see the neighborhood and an approximate distance, never your exact address."
              />
            </div>
            <Button block className="mt-4" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save profile'}
            </Button>
            {message ? (
              <p
                className={`mt-2 text-[12px] ${failed ? 'text-[var(--color-danger)]' : 'text-[var(--color-brand)]'}`}
                role={failed ? 'alert' : 'status'}
              >
                {message}
              </p>
            ) : null}
          </Card>

          <Card className="mt-4 p-5">
            <h2 className="card-title">Your skills</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {skills.length === 0 ? (
                <p className="text-[12px] text-[var(--color-muted)]">No skills added yet.</p>
              ) : null}
              {skills.map((skill) => (
                <span key={skill} className="flex items-center gap-2">
                  <Chip>{skill}</Chip>
                  <button
                    type="button"
                    onClick={() => setSkills(skills.filter((item) => item !== skill))}
                    className="text-[11px] text-[var(--color-muted)] underline"
                  >
                    Remove
                  </button>
                </span>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const next = skillDraft.trim();
                if (!next || skills.includes(next)) return;
                setSkills([...skills, next].slice(0, 12));
                setSkillDraft('');
              }}
            >
              <input
                className="field h-[38px] flex-1 text-[12.5px]"
                value={skillDraft}
                onChange={(event) => setSkillDraft(event.target.value)}
                placeholder="Add a skill, e.g. Shelving"
                aria-label="Add a skill"
              />
              <Button type="submit" variant="ghost">
                Add skill
              </Button>
            </form>
            <p className="mt-2 text-[11.5px] text-[var(--color-muted-2)]">
              Skills are saved with the profile above.
            </p>
          </Card>
        </div>
        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12.5px] font-medium">Available for work</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                  {available ? 'You’re visible to nearby customers' : 'Your profile is hidden from search'}
                </p>
              </div>
              <Toggle checked={available} onChange={setAvailable} label="Available for work" />
            </div>
            <Button block variant="ghost" className="mt-3" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save availability'}
            </Button>
          </Card>
          <Callout title="A little privacy, by design">
            Your exact address is never shown. Neighbors see your neighborhood and approximate distance.
          </Callout>
          <p className="text-[11px] leading-[1.6] text-[var(--color-muted-2)]">
            Your rate comes from each service listing, so changing a price never changes an existing booking.
          </p>
        </aside>
      </div>
      <FooterNote />
    </>
  );
}

export function CreateServicePage({ edit = false }: { edit?: boolean }) {
  const { services, user, profile } = useApp();
  const { id } = useParams();
  const service = edit ? services.find((s) => s.id === id) : undefined;
  const navigate = useNavigate();
  const [name, setName] = useState(service?.name ?? '');
  const [rate, setRate] = useState(service ? String(service.rate) : '');
  const [minHours, setMinHours] = useState('2');
  const [category, setCategory] = useState(service?.category ?? 'Assembly');
  const [description, setDescription] = useState(service?.description ?? '');
  const [area, setArea] = useState(service?.area ?? '');
  const [image, setImage] = useState(service?.image ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!user) {
      setError('Sign in again before uploading a photo.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setImage(await uploadListingPhoto(user.uid, file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not upload that photo.');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!user) {
      setError('Sign in again before publishing.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveService({
        id: service?.id,
        title: name,
        category,
        description,
        rate: Number(rate.replace(/[^0-9]/g, '')) || 0,
        minHours: Number(minHours) || 1,
        area,
        image,
      });
      navigate('/mate/services');
    } catch (reason) {
      setError(callableErrorMessage(reason));
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={edit ? 'Edit your service' : 'Create a service'} subtitle="A little care, from first request to final tidy-up." />
      <div className="mt-5 grid grid-cols-[1fr_240px] gap-6 max-lg:grid-cols-1">
        <div>
          <Card className="p-5">
            <div className="space-y-3">
              <TextInput label="Service name" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
                <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {['Assembly', 'Cleaning', 'Repairs', 'Errands', 'Tech help', 'Yard & garden'].map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </Select>
                <TextInput label="Hourly rate" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
                <Select label="Minimum booking" value={minHours} onChange={(e) => setMinHours(e.target.value)}>
                  <option value="1">1 hour</option>
                  <option value="2">2 hours</option>
                  <option value="3">3 hours</option>
                </Select>
                <TextInput label="Service area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Poblacion, Amorsolo & nearby" />
              </div>
              <TextArea label="Description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
              <div>
                <p className="label">Service photo</p>
                <div className="flex items-center gap-3">
                  {image ? (
                    <img src={image} alt="" className="h-16 w-24 rounded-[8px] object-cover" />
                  ) : (
                    <span className="grid h-16 w-24 place-items-center rounded-[8px] bg-[var(--color-soft)] text-[11px] text-[var(--color-muted)]">
                      No photo
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => photoInput.current?.click()}
                    className="text-[12px] text-[var(--color-brand)]"
                    disabled={busy}
                  >
                    {image ? 'Replace photo' : 'Add a photo'}
                  </button>
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      void uploadPhoto(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                </div>
              </div>
            </div>
            <Button block className="mt-4" onClick={() => void publish()} disabled={busy}>
              {busy ? 'Saving…' : edit ? 'Save changes' : 'Publish service'}
            </Button>
            {error ? (
              <p className="mt-2 text-[12px] text-[var(--color-danger)]" role="alert">
                {error}
              </p>
            ) : null}
          </Card>
          <div className="tip mt-4">
            <p className="font-medium">Pricing that feels fair</p>
            <p className="mt-1">
              Set an hourly rate you can sustain. Customers see your exact rate, minimum hours and any travel fee
              before they book.
            </p>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="card overflow-hidden">
            <div className="border-b border-[var(--color-line-2)] px-4 py-2.5 text-[11.5px] text-[var(--color-muted)]">Your service preview</div>
            <img src={service?.image || undefined} alt="" className="h-[120px] w-full object-cover" />
            <div className="p-4">
              <p className="text-[13.5px] font-medium">{name}</p>
              <p className="mt-0.5 text-[11.5px] text-[var(--color-muted)]">{profile.name || 'You'} · {category}</p>
              <p className="mt-2 text-[14px] font-medium">₱{rate} / hr</p>
              <p className="mt-1 text-[11px] leading-[1.5] text-[var(--color-muted)]">{description}</p>
            </div>
          </div>
          <Callout title="Before you publish">
            Publishing makes your listing bookable. You can pause it anytime from your services page.
          </Callout>
          <div className="card p-4">
            <p className="text-[12.5px] font-medium">Sold by the hour</p>
            <p className="mt-1 text-[11.5px] leading-[1.6] text-[var(--color-muted)]">
              Customers see your rate, minimum and available start times before booking.
            </p>
          </div>
        </aside>
      </div>
      <FooterNote />
    </>
  );
}

export function WorkingHoursPage() {
  const [days, setDays] = useState<Record<string, boolean>>({
    Mon: true,
    Tue: true,
    Wed: true,
    Thu: true,
    Fri: true,
    Sat: false,
    Sun: false,
  });
  const [saved, setSaved] = useState(false);
  const [day, setDay] = useState(manilaToday());

  return (
    <>
      <PageHeader title="Set your working hours" subtitle="Your time, your terms." />
      <div className="mt-5 grid grid-cols-[1fr_240px] gap-6 max-lg:grid-cols-1">
        <div>
          <Card className="p-5">
            <h2 className="card-title">Weekly hours</h2>
            <div className="mt-3 divide-y divide-[var(--color-line-2)]">
              {Object.keys(days).map((day) => (
                <div key={day} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="flex items-center gap-3">
                    <Toggle
                      checked={days[day]}
                      onChange={(value) => setDays({ ...days, [day]: value })}
                      label={`${day} availability`}
                    />
                    <span className={`text-[13px] ${days[day] ? '' : 'text-[var(--color-muted)]'}`}>{day}</span>
                  </span>
                  <span className="text-[12px] text-[var(--color-muted)]">
                    {days[day] ? '9:00 AM – 6:00 PM' : 'Unavailable'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 max-lg:grid-cols-1">
              <TextInput label="Buffer between jobs" defaultValue="30 minutes" />
              <TextInput label="Daily booking limit" defaultValue="3 jobs" />
            </div>
            <TextArea
              label="Note for customers"
              rows={3}
              className="mt-3"
              defaultValue="I usually reply within the hour. Same-week bookings are best."
            />
            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={() => {
                  setSaved(true);
                  window.setTimeout(() => setSaved(false), 2500);
                }}
              >
                Save working hours
              </Button>
              {saved ? <span className="text-[12px] text-[var(--color-brand)]">Saved</span> : null}
            </div>
          </Card>
          <div className="tip mt-4">
            <p className="font-medium">Your working days</p>
            <p className="mt-1">Customers only see start times inside these hours and inside your service area.</p>
          </div>
        </div>
        <aside className="flex flex-col gap-4">
          <Card className="p-4">
            <MonthCalendar value={day} onSelect={setDay} />
          </Card>
          <Callout title="A little flexibility">
            You can pause availability anytime from your profile. Existing bookings stay confirmed.
          </Callout>
        </aside>
      </div>
      <FooterNote />
    </>
  );
}

export function ServiceAreaPage() {
  const [radius, setRadius] = useState('5');
  return (
    <>
      <PageHeader title="Where do you work?" subtitle="A clear service area keeps expectations kind." />
      <div className="mt-5 grid grid-cols-[1fr_240px] gap-6 max-lg:grid-cols-1">
        <div>
          <Card className="p-5">
            <TextInput label="Service area" defaultValue="Poblacion, Amorsolo & nearby" />
            <div className="mt-3 grid grid-cols-2 gap-4 max-lg:grid-cols-1">
              <Select label="Travel radius" value={radius} onChange={(e) => setRadius(e.target.value)}>
                <option value="3">Within 3 km</option>
                <option value="8">Within 8 km</option>
                <option value="15">Within 15 km</option>
              </Select>
              <TextInput label="Travel fee after radius" defaultValue="₱0" />
            </div>

            <MapSketch className="mt-4" />
            <p className="mt-2 text-[11.5px] text-[var(--color-muted-2)]">
              Illustrative map · sample pin, not live location.
            </p>
            <Button block className="mt-4">
              Save service area
            </Button>
          </Card>
          <div className="mt-4 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            {['Poblacion', 'Bel-Air', 'Timog Avenue'].map((zone) => (
              <div key={zone} className="card px-4 py-3 text-[12px]">
                <p className="font-medium">{zone}</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">About 2 km away</p>
              </div>
            ))}
          </div>
        </div>
        <aside className="flex flex-col gap-4">
          <Callout title="A little privacy, by design">
            Customers see only the general area until a request is accepted. Exact addresses unlock after acceptance.
          </Callout>
          <div className="card p-4">
            <p className="text-[12.5px] font-medium">Travel time matters</p>
            <p className="mt-1 text-[11.5px] leading-[1.6] text-[var(--color-muted)]">
              A smaller radius usually means more on-time arrivals and fewer cancellations.
            </p>
          </div>
        </aside>
      </div>
      <FooterNote />
    </>
  );
}

export function ServicesListPage() {
  const { services, status } = useApp();
  const loading = status === 'connecting' && services.length === 0;
  return (
    <>
      <PageHeader
        title="Your services"
        subtitle="Prices, hours and the details customers see."
        actions={
          <Link to="/mate/services/new" className="btn btn-primary btn-sm h-[38px]">
            New service
          </Link>
        }
      />
      <div className="mt-5 space-y-3">
        {loading ? (
          <Callout title="Loading your services">Fetching the listings customers can book.</Callout>
        ) : null}
        {!loading && services.length === 0 ? (
          <Callout title="No services yet">
            Publish your first service so customers nearby can book you.
          </Callout>
        ) : null}
        {services.slice(0, 6).map((service, index) => (
          <Card key={service.id} className="flex items-center gap-4 p-4">
            <img src={service.image} alt="" className="h-14 w-20 rounded-[8px] object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium">{index === 0 ? 'Furniture assembly' : `Furniture assembly ${['B', 'C'][index - 1]}`}</p>
              <p className="mt-0.5 text-[11.5px] text-[var(--color-muted)]">
                ₱{service.rate} / hr · {service.category} · {service.tags[0]}
              </p>
            </div>
            <Chip small tone={index === 2 ? 'neutral' : 'brand'}>
              {index === 2 ? 'Paused' : 'Live'}
            </Chip>
            <Link to={`/mate/services/${service.id}/edit`} className="link text-[12px]">
              Edit
            </Link>
          </Card>
        ))}
      </div>
      <div className="tip mt-4">
        <p className="font-medium">Keep it clear</p>
        <p className="mt-1">A specific title, honest description and a realistic minimum help the right customers find you.</p>
      </div>
      <FooterNote />
    </>
  );
}
