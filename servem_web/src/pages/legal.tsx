import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader } from '../components/SiteHeader';

const EFFECTIVE_DATE = 'October 26, 2026';
const CONTACT_EMAIL = 'legal@servem.ph';
const DPO_EMAIL = 'privacy@servem.ph';

function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: { id: string; heading: string; body: ReactNode }[];
}) {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-16 pt-10">
        <div className="max-w-[75ch]">
          <h1 className="text-[34px] font-semibold leading-[1.15]">{title}</h1>
          <p className="mt-2 text-[13px] text-[var(--color-muted)]">
            <time dateTime="2026-10-26">Effective {updated}</time> · Applies to servem.ph and the ServEm mobile app.
          </p>
          <p className="mt-5 text-[15px] leading-[1.7] text-[var(--color-ink-2)]">{intro}</p>
        </div>

        <nav aria-label="Document sections" className="mt-8 max-w-[75ch] rounded-[12px] border border-[var(--color-line)] bg-[var(--color-soft)] p-5">
          <h2 className="text-[13px] font-semibold tracking-[0.06em] text-[var(--color-muted)] uppercase">Contents</h2>
          <ol className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[13.5px] max-sm:grid-cols-1">
            {sections.map((section) => (
              <li key={section.id}>
                <a className="link" href={`#${section.id}`}>
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-8 max-w-[75ch] space-y-8">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-[20px] font-semibold leading-[1.3]">{section.heading}</h2>
              <div className="mt-3 space-y-3 text-[14.5px] leading-[1.75] text-[var(--color-ink-2)]">{section.body}</div>
            </section>
          ))}
        </div>

        <p className="mt-10 border-t border-[var(--color-line)] pt-6 text-[12.5px] text-[var(--color-muted)]">
          Questions about this document: write to{' '}
          <a className="link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          . ServEm operates in the Republic of the Philippines and these documents are written to be read alongside
          Philippine law.
        </p>
      </main>
    </div>
  );
}

const Clauses = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc pl-5 space-y-2">
    {items.map((item, index) => (
      <li key={index}>{item}</li>
    ))}
  </ul>
);

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={EFFECTIVE_DATE}
      intro="These terms are the agreement between you and ServEm PH, the Philippine operator of servem.ph and the ServEm mobile app. By creating an account or using the marketplace you accept them. ServEm is a marketplace: customers and independent ServMates arrange the work, and ServEm provides the booking, messaging, pricing and support tools around it."
      sections={[
        {
          id: 'who-may-use',
          heading: '1. Who may use ServEm',
          body: (
            <>
              <p>
                You must be at least 18 years old, or 16 or 17 and participating only with the written consent of a
                parent or legal guardian, to hold a ServEm account. You must register with your own details, one
                account per person, and keep your password and devices secure.
              </p>
              <p>You are responsible for everything that happens under your account.</p>
            </>
          ),
        },
        {
          id: 'services-and-roles',
          heading: '2. What ServEm does and does not do',
          body: (
            <>
              <p>
                ServEm lists services published by ServMates, lets customers request them at a stated hourly rate, and
                records the booking, the messages exchanged, and the payments you authorise.
              </p>
              <p>
                ServEm is not the employer of any ServMate and does not perform the work. ServMates are independent
                service providers responsible for their own tools, skills, scheduling, taxes, and Business Permits and
                professional clearances where their trade requires them.
              </p>
              <Clauses
                items={[
                  'ServEm does not guarantee that a ServMate will accept, arrive on time, or complete a job.',
                  'ServEm does not warrant the quality of work, but operates the review, dispute and refund processes in Sections 6 and 7.',
                  'Any insurance, bonding or professional licensing a ServMate holds is the ServMate’s own arrangement.',
                ]}
              />
            </>
          ),
        },
        {
          id: 'listings',
          heading: '3. Listings, availability and acceptance',
          body: (
            <p>
              A ServMate creates a listing with a name, category, hourly rate in Philippine pesos, minimum hours, and
              service area. A customer request becomes a booking only when the ServMate accepts it. Until then nothing
              is charged and the exact street address stays hidden from the ServMate. Either side may cancel before
              acceptance without a fee. Prices displayed in the app are estimates; the final amount is the accepted
              rate multiplied by the hours recorded, plus the ServEm service fee.
            </p>
          ),
        },
        {
          id: 'fees-and-payments',
          heading: '4. Fees, payment and refunds',
          body: (
            <>
              <p>
                ServEm charges a service fee of 10% of the labour subtotal, shown as a separate line before you confirm
                a booking. Accepted payment methods are GCash, Maya, bank transfer, and cash on completion. Payment
                amounts, refund windows and payout schedules are handled by ServEm’s licensed payment service
                providers under their own terms, which apply together with these terms.
              </p>
              <Clauses
                items={[
                  'You authorise the charge you confirm. ServEm does not take payment for a service you have not approved.',
                  'Refund requests must be filed through the booking, and are assessed under Section 7.',
                  'ServMate earnings become withdrawable after the job is marked complete and any dispute window closes.',
                  'Chargebacks and disputed transactions are investigated before funds are released.',
                ]}
              />
            </>
          ),
        },
        {
          id: 'conduct',
          heading: '5. Conduct, safety and prohibited use',
          body: (
            <>
              <p>Both sides must keep the marketplace safe and legal. You agree not to:</p>
              <Clauses
                items={[
                  'Arrange, advertise or perform any service that is unlawful in the Philippines.',
                  'Move the conversation or the payment off ServEm to evade the service fee or the dispute process.',
                  'Enter a premises for any purpose other than the agreed service, or keep access credentials after the job.',
                  'Harass, discriminate against, or work with minors without a supervising adult present.',
                  'Upload another person’s identification, impersonate anyone, or post content you do not have the right to share.',
                  'Scrape, probe, overload or otherwise attempt to compromise the platform or other users’ accounts.',
                ]}
              />
              <p>
                ServEm may pause a listing, limit an account, or remove a user who breaches this section, and will state
                the reason and the appeal route in the notice.
              </p>
            </>
          ),
        },
        {
          id: 'reviews',
          heading: '6. Reviews and ratings',
          body: (
            <p>
              Reviews may be written only by a party to a completed booking and must reflect a real experience. Reviews
              that are false, abusive, off-topic, or submitted to manipulate a rating may be withheld or removed after
              moderation. ServEm does not sell, buy or suppress ratings.
            </p>
          ),
        },
        {
          id: 'disputes',
          heading: '7. Cancellations, disputes and complaints',
          body: (
            <>
              <p>
                Open a dispute from the booking within 72 hours of the scheduled completion. Describe what happened and
                attach evidence. ServEm support reviews the booking record, the messages, and any photographs, and
                decides on a full refund, partial refund, credit, or no action. Refunds go back to the original payment
                method; cash-on-completion cases are settled by bank transfer or wallet credit.
              </p>
              <p>
                Decisions you are not satisfied with may be appealed once within 7 days. Nothing in these terms limits
                rights you cannot waive under the Consumer Act of the Philippines (Republic Act No. 7394) or the
                Electronic Commerce Act (Republic Act No. 8792).
              </p>
            </>
          ),
        },
        {
          id: 'data',
          heading: '8. Personal data',
          body: (
            <p>
              ServEm processes personal information as Data Controller under the Data Privacy Act of 2012 (Republic Act
              No. 10173) and its Implementing Rules and Regulations. Consent, contractual necessity, and legal
              obligation are the bases we rely on. The full explanation — including your rights as a data subject, the
              NPC complaint route, retention periods and our security posture — is in the{' '}
              <Link className="link" to="/privacy">
                Privacy Policy
              </Link>
              .
            </p>
          ),
        },
        {
          id: 'interruption',
          heading: '9. Availability, changes and availability of the service',
          body: (
            <p>
              ServEm is provided on an “as available” basis. We may change features, rates, coverage areas, or these
              terms. Material changes are announced in the app and by email at least 14 days before they take effect,
              except where a change is required for safety or legal reasons and cannot wait. Continuing to use ServEm
              after the effective date means you accept the revised terms.
            </p>
          ),
        },
        {
          id: 'liability',
          heading: '10. Liability',
          body: (
            <>
              <p>
                To the extent allowed by Philippine law, ServEm’s aggregate liability for claims arising from your use
                of the platform is limited to the greater of the service fees you paid, or the amount of the specific
                transaction in dispute. ServEm is not liable for indirect or consequential loss, and is not liable for
                the acts or omissions of the other party to a booking.
              </p>
              <p>
                These limits do not apply to liability that cannot be limited under Philippine law, including
                ServEm’s own wilful misconduct or fraud and liabilities under the Data Privacy Act.
              </p>
            </>
          ),
        },
        {
          id: 'termination',
          heading: '11. Ending your account',
          body: (
            <p>
              You may close your account at any time from Settings. ServEm may suspend or close an account for breach
              of these terms, for safety reasons, or when required by law or a competent authority. Closing an account
              does not cancel bookings already accepted, and does not erase records ServEm must lawfully retain.
            </p>
          ),
        },
        {
          id: 'law',
          heading: '12. Governing law and venue',
          body: (
            <p>
              These terms are governed by the laws of the Republic of the Philippines. Disputes will first be taken to
              good-faith settlement through ServEm support; if that fails, the parties submit to the courts of
              Metro Manila, without prejudice to your right to file with the National Privacy Commission for personal
              data matters or with the Department of Trade and Industry for consumer complaints.
            </p>
          ),
        },
      ]}
    />
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={EFFECTIVE_DATE}
      intro="ServEm PH is the Personal Information Controller for the data described here, and reports to the National Privacy Commission (NPC) of the Philippines. This policy explains what we collect, why, who we share it with, how long we keep it, and how you exercise the rights given to you by the Data Privacy Act of 2012 (Republic Act No. 10173)."
      sections={[
        {
          id: 'what-we-collect',
          heading: '1. What we collect',
          body: (
            <Clauses
              items={[
                'Account data: name, email, mobile number, password hash held by our authentication provider, city, and profile photo.',
                'Booking data: service requested, address you enter, scheduled date and time, hours, notes, price, and status history.',
                'Messages exchanged between you and the other party through ServEm.',
                'Transaction data: payment method token, amount, fee, and settlement status. ServEm does not store full card numbers.',
                'Verification data for ServMates: government-issued identification and proof of address, used only to confirm identity.',
                'Usage data: device type, app version, crash reports and pages viewed, used to keep the service working.',
                'Support data: tickets, disputes and their evidence.',
              ]}
            />
          ),
        },
        {
          id: 'why-we-use-it',
          heading: '2. Why we use it, and the lawful basis',
          body: (
            <>
              <Clauses
                items={[
                  'To create and complete the booking you asked for — contractual necessity.',
                  'To authenticate you, prevent fraud and abuse, and keep records accurate — legitimate interest and legal obligation.',
                  'To process payments and issue receipts — contractual necessity and legal obligation under Philippine tax rules.',
                  'To verify ServMate identity before work begins — consent and legitimate interest.',
                  'To answer complaints and disputes — legal obligation and legitimate interest.',
                  'To send product or service announcements — consent only, with unsubscribe in every message.',
                ]}
              />
              <p className="mt-3">
                We do not sell your personal information, and we do not use verification documents for anything other
                than identity checks.
              </p>
            </>
          ),
        },
        {
          id: 'who-see-it',
          heading: '3. Who can see your information',
          body: (
            <>
              <p>Within a booking, visibility is deliberately partial:</p>
              <Clauses
                items={[
                  'A ServMate sees your first name, the area and the time, and only general location, until they accept.',
                  'The exact street address, unit and arrival notes unlock for the accepted ServMate on the service date only.',
                  'Your phone number is never exposed; calls and messages route through ServEm where the platform supports it.',
                  'Your payment card or wallet credentials are never shown to the other party.',
                ]}
              />
              <p>
                Outside the booking, we share the minimum necessary with: our hosting and database provider, our
                payment service providers, our SMS and email delivery providers, and auditors or advisers bound by
                confidentiality. We disclose personal information to police, courts or the NPC only when legally
                required, and we record every such request.
              </p>
            </>
          ),
        },
        {
          id: 'storage-transfer',
          heading: '4. Where data is stored and cross-border transfers',
          body: (
            <p>
              Primary storage is in the Google Cloud infrastructure that serves our project, with the Philippines as
              the working region. Where a subprocessor is outside the Philippines, we rely on your consent, contractual
              safeguards, and the recipient’s obligation to give a level of protection comparable to the Data Privacy
              Act, as contemplated by Section 17 of the Act and its Implementing Rules.
            </p>
          ),
        },
        {
          id: 'retention',
          heading: '5. How long we keep it',
          body: (
            <Clauses
              items={[
                'Account and profile data — while your account is open, then 30 days to allow recovery.',
                'Booking records, messages and transaction records — 5 years, matching Philippine tax and consumer-record retention.',
                'Verification documents — deleted within 30 days of a decision, except where a dispute or legal hold requires retention.',
                'Support and dispute evidence — for the lifetime of the case plus 5 years.',
                'Crash and usage logs — 90 days in identifiable form, then aggregated.',
                'Closed-account data — anonymised except for records we must legally preserve.',
              ]}
            />
          ),
        },
        {
          id: 'your-rights',
          heading: '6. Your rights as a data subject',
          body: (
            <>
              <p>Under Section 16 of the Data Privacy Act you may request:</p>
              <Clauses
                items={[
                  'Consent — to know when and how you gave it, and to withdraw it.',
                  'Notice — to be told what is collected and why.',
                  'Access and correction — to obtain a copy of your file and fix errors.',
                  'Objection — to stop processing for marketing, profiling or direct solicitation.',
                  'Erasure or blocking — to delete or suspend data that is unlawful, excessive or outdated.',
                  'Damages — to claim compensation for a violation we caused.',
                  'Data portability — to receive your data in a structured machine-readable format.',
                  'Complaint — to file with the National Privacy Commission, imp.npc.gov.ph, in addition to contacting us.',
                ]}
              />
              <p>
                Send requests to{' '}
                <a className="link" href={`mailto:${DPO_EMAIL}`}>
                  {DPO_EMAIL}
                </a>
                . We acknowledge within 5 business days and resolve within 15, and we may ask for proof of identity
                before releasing data.
              </p>
            </>
          ),
        },
        {
          id: 'security',
          heading: '7. How we protect it',
          body: (
            <p>
              Access is layered and least-privilege by default: authentication through a managed identity provider
              with email verification; database reads and writes restricted by per-collection ownership rules so a
              client can only touch its own records; privileged actions such as price calculation, status changes,
              refunds and verification decisions executed only by server-side functions; upload paths restricted by
              size and file type; transport encrypted end to end; security headers and a content security policy
              enforced at the CDN; and an append-only audit log recording every administrative action with actor,
              reason and timestamp. We review access quarterly, require strong passwords, and report any qualifying
              breach to the NPC and to affected users within the timeframes the Data Privacy Act requires.
            </p>
          ),
        },
        {
          id: 'cookies',
          heading: '8. Cookies and local storage',
          body: (
            <p>
              ServEm uses only the storage strictly required to sign you in and remember your session preferences. We
              do not use advertising cookies. Analytics is limited to aggregate product usage. If we later add any
              non-essential tracker, this section will change and we will ask for consent first.
            </p>
          ),
        },
        {
          id: 'children',
          heading: '9. Children',
          body: (
            <p>
              ServEm is not directed at children. A 16- or 17-year-old may use the platform only through a household
              account managed with the written consent of a parent or guardian, and we do not knowingly market to or
              profile minors.
            </p>
          ),
        },
        {
          id: 'changes',
          heading: '10. Changes to this policy',
          body: (
            <p>
              We update this policy when our processing changes. Material changes are notified in the app and by email
              at least 14 days before they take effect, and the effective date at the top of this page is revised. The
              version in force is the version that applies to processing that already happened.
            </p>
          ),
        },
        {
          id: 'contact',
          heading: '11. Contact and complaint route',
          body: (
            <p>
              Data Protection Officer: ServEm PH,{' '}
              <a className="link" href={`mailto:${DPO_EMAIL}`}>
                {DPO_EMAIL}
              </a>
              . General legal enquiries:{' '}
              <a className="link" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              . You may also file a complaint directly with the National Privacy Commission of the Philippines.
            </p>
          ),
        },
      ]}
    />
  );
}

export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <span className={className}>
      <Link className="link" to="/terms">
        Terms of Service
      </Link>
      {' · '}
      <Link className="link" to="/privacy">
        Privacy Policy
      </Link>
    </span>
  );
}
