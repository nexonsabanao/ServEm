import Link from 'next/link';
import { ChevronRightIcon } from '@/app/components/icons';

export const metadata = {
  title: 'Terms and conditions — ServEm',
  description:
    'How ServEm works: who can use it, booking requests, prices and payment, privacy, complaints and disputes.',
};

/**
 * The terms ServEm asks people to accept by using the site.
 *
 * Every clause describes behaviour the product actually has or the plan has
 * fixed: the marketplace introduces customers to independent ServMates, a
 * booking starts as a request, nothing is charged until the job is done, and
 * complaint handling follows the internal redress pathway the launch plan
 * requires. Where the plan still has an open decision — the exact contractual
 * wording, the support mailbox — the clause says so instead of inventing an
 * answer, and the document carries its draft status at the top.
 */
const CLAUSES: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: 'what-servem-is',
    title: 'What ServEm is',
    body: (
      <>
        <p>
          ServEm is a marketplace for local, in-person services. We introduce customers to
          independent service providers (&ldquo;ServMates&rdquo;), publish their listings, rates and
          coverage areas, and give both sides the tools to send booking requests and messages.
        </p>
        <p>
          The service itself is contracted between you and the ServMate. ServEm does not perform
          the work, set the ServMate&rsquo;s price for a specific job, or employ ServMates — they
          are independent contractors working on their own account.
        </p>
      </>
    ),
  },
  {
    id: 'who-can-use',
    title: 'Who can use ServEm',
    body: (
      <>
        <p>ServEm is for adults aged 18 and over. Do not create an account for someone else.</p>
        <ul>
          <li>Give a name and email address that are yours, and keep them current.</li>
          <li>One person, one account. Do not share your sign-in or lend it out.</li>
          <li>Tell us straight away if you think someone else has used your account.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'your-account',
    title: 'Your account',
    body: (
      <>
        <p>
          You choose a password when you sign up, and you can change your name and password at any
          time in Settings. Ending every other signed-in device is also in Settings, under
          Security.
        </p>
        <p>
          Settings also holds a copy of what ServEm stores about you — your requests and messages —
          as a file you can download. Closing an account is not self-service yet; ask support and
          we will remove it, keeping only records we are required to hold.
        </p>
      </>
    ),
  },
  {
    id: 'booking-requests',
    title: 'Booking requests and cancellations',
    body: (
      <>
        <p>
          Booking starts with a request. You pick a service, describe the job, and send it; you get
          a reference code such as <span className="terms-ref">SE-2610CA</span> to quote later. A
          request is not a confirmed booking — it becomes one when the ServMate accepts it and you
          agree the scope, price and time.
        </p>
        <p>
          You can cancel a request while it is still open, from My requests. Cancelling is free:
          nothing has been paid at that point. Once work has been agreed, the cancellation and
          refund terms are the ones you and the ServMate settled — put them in writing before the
          job starts.
        </p>
      </>
    ),
  },
  {
    id: 'prices-and-payment',
    title: 'Prices, payment and fees',
    body: (
      <>
        <p>
          A listing price is a published rate or a starting price, not necessarily the final cost
          of your job. Anything above the published rate has to be quoted and agreed by both of
          you before the work begins.
        </p>
        <p>
          Sending a request costs nothing. Payment happens after the job is done, on whatever terms
          you agreed with the ServMate. ServEm is not a wallet and does not hold your money in
          trust. When payments are switched on they will be processed by a licensed payment
          provider, and any ServEm fee will be shown to you before you confirm — never after.
        </p>
      </>
    ),
  },
  {
    id: 'messaging',
    title: 'Messages',
    body: (
      <>
        <p>
          Messages stay inside ServEm so there is a record of what was agreed. Each message is
          capped at 4,000 characters.
        </p>
        <p>
          Keep messages about the job. We may read them when handling a safety report, a complaint
          or a dispute, so that a decision rests on evidence rather than one person&rsquo;s account.
        </p>
      </>
    ),
  },
  {
    id: 'servmate-rules',
    title: 'What ServMates owe customers',
    body: (
      <>
        <ul>
          <li>A listing that is true: real rates, real coverage, real availability.</li>
          <li>
            Work of the standard the listing promises, at the price and time agreed, or an early
            message when something has to change.
          </li>
          <li>
            Any licence, registration or permit the job legally needs — self-declaration is not a
            substitute for a required credential.
          </li>
          <li>No contact details, payment links or meetups arranged to bypass ServEm.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'prohibited',
    title: 'Prohibited services and content',
    body: (
      <>
        <p>
          ServEm opens one category at a time, starting with lower-risk work. If a category is not
          listed, it is not allowed, and asking does not make it permitted.
        </p>
        <ul>
          <li>Anything unlawful in the Philippines, or that harms another person.</li>
          <li>Regulated or high-risk services that have not been reviewed and opened.</li>
          <li>Listings that mislead: fake services, copied photos, invented credentials.</li>
          <li>Abuse, harassment, or discriminatory content in listings and messages.</li>
        </ul>
        <p>
          We can take down a listing or restrict an account that breaks these rules, and you can
          appeal a decision — see Complaints and disputes below.
        </p>
      </>
    ),
  },
  {
    id: 'reviews',
    title: 'Reviews',
    body: (
      <p>
        A review can only come from someone with a real request or completed job with that
        ServMate. Reviews are moderated, and ServMates can appeal one they believe is unfair or
        fake. Reviews may not be edited after submission beyond the moderation decision.
      </p>
    ),
  },
  {
    id: 'safety-and-reports',
    title: 'Safety and reports',
    body: (
      <p>
        If a ServMate, a customer or a listing is unsafe, report it from the account area. Reports
        are reviewed before action is taken wherever possible, and anything urgent should also go
        to the Philippine National Police or your local authorities — ServEm is not an emergency
        service.
      </p>
    ),
  },
  {
    id: 'complaints',
    title: 'Complaints and disputes',
    body: (
      <>
        <p>
          Start by raising a request from your account, quoting the reference of the job it is
          about. Before ServEm opens to the public, complaints move to a proper case system: each
          one gets a case ID, the evidence stays attached to it, and you receive the decision and
          can ask for it to be reviewed again.
        </p>
        <p>
          Disputes about the work itself — quality, damage, a no-show — are first a matter between
          you and the ServMate, with ServEm providing the record of the request, the messages and
          the agreed price. Where a refund is due and has been paid through ServEm, it comes back
          the way you paid.
        </p>
      </>
    ),
  },
  {
    id: 'privacy',
    title: 'Your information',
    body: (
      <>
        <p>
          ServEm stores your name, email, password hash, preferences, the requests you send with
          their messages, and a sign-in cookie. ServMates see only what a job needs: the service,
          the area, your message and the name on your account. No card details and no precise
          location are stored by ServEm.
        </p>
        <p>
          Under the Data Privacy Act you can ask for a copy of your information, ask us to correct
          it, or object to how it is used. Download your data from Settings; for anything else,
          raise a request and we will act on it, keeping only records we are legally required to
          retain.
        </p>
      </>
    ),
  },
  {
    id: 'liability',
    title: 'Disclaimers and liability',
    body: (
      <>
        <p>
          Verification status means a ServMate passed the checks published at the time — it is not
          a guarantee of the work, and it does not make ServEm a party to the service. ServEm is
          not responsible for the quality, timing, legality or outcome of work performed by a
          ServMate.
        </p>
        <p>
          To the maximum extent Philippine law allows, ServEm is not liable for indirect or
          consequential losses arising from a service booked through the platform, and its total
          liability for any claim is limited to the fees ServEm has charged you for the booking
          concerned. Nothing here limits rights you have as a consumer that the law does not allow
          to be limited.
        </p>
      </>
    ),
  },
  {
    id: 'suspension',
    title: 'Suspension and closure',
    body: (
      <p>
        We can suspend or close an account that breaks these terms, puts other people at risk, or
        is under investigation for fraud. Where it is safe to do so, we tell you first and you can
        export your data before it closes.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        These terms change as ServEm does — new categories, payments going live, new payment
        providers. When a change materially affects you, we will say so in the app before it takes
        effect. Continuing to use ServEm after that means you accept the change.
      </p>
    ),
  },
  {
    id: 'governing-law',
    title: 'Governing law and how to reach us',
    body: (
      <>
        <p>
          These terms are governed by the laws of the Philippines. If a complaint cannot be settled
          with the ServMate or with us, you keep every right to take it to the proper Philippine
          courts or under consumer-protection processes, including those under the Internet
          Transactions Act.
        </p>
        <p>
          Support contact details will be published here before ServEm opens to the public. Until
          then, raise a request from your account and quote the reference in any follow-up.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <div className="terms-page">
      <header className="site-header">
        <div className="header-inner shell">
          <Link href="/" className="brand" aria-label="ServEm home" translate="no">
            <span className="brand-mark" aria-hidden="true">S</span>
            <span className="brand-word">servem</span>
          </Link>
          <Link className="quiet-link terms-back" href="/">
            Back to ServEm <span aria-hidden="true"><ChevronRightIcon /></span>
          </Link>
        </div>
      </header>

      <main className="terms-main shell" id="terms-main">
        <div className="terms-masthead">
          <p className="terms-eyebrow"><span className="eyebrow-line" aria-hidden="true" />LEGAL</p>
          <h1>Terms and conditions</h1>
          <p className="terms-standfirst">
            The agreement between you and ServEm when you browse, send a request, or work through
            the platform as a ServMate.
          </p>
          <div className="terms-meta">
            <span>Version 0.1 · Draft</span>
            <span className="terms-meta-note">
              These terms have not been approved by Philippine counsel yet and are not in force.
            </span>
          </div>
        </div>

        <div className="terms-notice" role="note">
          <strong>Status of this document.</strong> ServEm is a design preview: services, ServMates
          and requests are sample data, and nothing is charged. These terms are written from the
          product plan, so a few clauses describe the complaint case system and payment handling
          that are planned but not switched on yet — each one says so where it appears. All of it
          requires review by a qualified Philippine lawyer before real users or real money are
          involved.
        </div>

        <div className="terms-layout">
          <nav className="terms-toc" aria-labelledby="terms-toc-title">
            <p className="terms-toc-title" id="terms-toc-title">On this page</p>
            <ol>
              {CLAUSES.map((clause, index) => (
                <li key={clause.id}>
                  <a href={`#${clause.id}`}>
                    <span className="terms-toc-no" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {clause.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="terms-clauses">
            {CLAUSES.map((clause, index) => (
              <section key={clause.id} id={clause.id} className="terms-clause" aria-labelledby={`${clause.id}-heading`}>
                <h2 id={`${clause.id}-heading`}>
                  <span className="terms-clause-no" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {clause.title}
                </h2>
                {clause.body}
              </section>
            ))}
          </div>
        </div>
      </main>

      <footer className="terms-foot shell">
        <span>ServEm — Real help, close to home.</span>
        <Link href="/">Back to the marketplace</Link>
      </footer>
    </div>
  );
}
