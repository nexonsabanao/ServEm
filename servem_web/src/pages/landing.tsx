import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Armchair,
  BadgeCheck,
  Banknote,
  CalendarDays,
  Check,
  ChevronDown,
  Leaf,
  Menu,
  MessagesSquare,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { InstallCta } from '../components/InstallCta';
import { Logo } from '../components/ui';

const currentYear = new Date().getFullYear();

const services = [
  {
    name: 'Repairs',
    title: 'Small home repairs',
    description: 'Loose hinges, minor fixtures and the odd jobs that cannot wait.',
    icon: Wrench,
  },
  {
    name: 'Cleaning',
    title: 'Home cleaning',
    description: 'Regular resets, deep cleaning and a fresh start for your space.',
    icon: Sparkles,
  },
  {
    name: 'Errands',
    title: 'Everyday errands',
    description: 'An extra pair of hands for pickups, queues and local tasks.',
    icon: ShoppingBag,
  },
  {
    name: 'Assembly',
    title: 'Furniture assembly',
    description: 'From flat pack to finished, with the right tools and careful work.',
    icon: Armchair,
  },
  {
    name: 'Tech help',
    title: 'Tech help at home',
    description: 'Patient help with device setup, Wi-Fi and everyday technology.',
    icon: Zap,
  },
  {
    name: 'Yard & garden',
    title: 'Yard & garden',
    description: 'Practical help to tidy, maintain and enjoy your outdoor space.',
    icon: Leaf,
  },
] as const;

const steps = [
  {
    title: 'Tell us what needs doing',
    body: 'Choose a service, describe the task and pick a time that works for you. You will see the rate and estimated total before sending a request.',
  },
  {
    title: 'Your ServMate accepts',
    body: 'A ServMate reviews and accepts your request. Once accepted, you can confirm the details and message each other without leaving ServEm.',
  },
  {
    title: 'Get the job done',
    body: 'Track the visit, mark the work complete and leave a review based on your real booking. Support is there if something needs attention.',
  },
] as const;

const faqs = [
  {
    question: 'How do I book a ServMate?',
    answer:
      'Create an account, choose a service and enter the task, location, date and time. Review the estimated price and send your request. It becomes a booking when the ServMate accepts it.',
  },
  {
    question: 'When do I pay?',
    answer:
      'Nothing is charged when you send a request. For GCash, Maya or bank transfer, payment is collected after the ServMate accepts. If you choose cash on completion, you pay your ServMate after the visit is marked complete.',
  },
  {
    question: 'How is the price calculated?',
    answer:
      'Each listing states an hourly rate and minimum hours in Philippine pesos. Your estimate is the labour subtotal plus ServEm’s 10% service fee, shown separately before you confirm. The final amount reflects the accepted rate and recorded hours.',
  },
  {
    question: 'What does a verified ServMate mean?',
    answer:
      'ServEm reviews the identity information a ServMate submits before they can take a paid job. Customers see the verification status, never the private identity documents. Verification does not guarantee availability or the quality of a service.',
  },
  {
    question: 'Can I message my ServMate before the visit?',
    answer:
      'Yes. Once your request is accepted, use the booking conversation to clarify access, materials and the scope of work. Keeping messages in ServEm also gives support useful context if you need help later.',
  },
  {
    question: 'What if something goes wrong?',
    answer:
      'Open the booking and contact support. You can file a dispute within 72 hours of the scheduled completion, describe what happened and attach evidence. The dispute process and appeal window are explained in the Terms of Service.',
  },
] as const;

function LandingHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="landing-header">
      <div className="shell-width landing-header-inner">
        <div className="landing-brand-group">
          <Logo />
          <a className="landing-support" href="#faq">
            Need a hand? Help &amp; support
          </a>
        </div>
        <nav className="landing-nav" aria-label="Landing page">
          <a href="#services">Services</a>
          <a href="#how-it-works">How it works</a>
          <a href="#servmates">For ServMates</a>
          <a href="#safety">Safety</a>
        </nav>
        <div className="landing-header-actions">
          <Link to="/login" className="landing-login">
            Log in
          </Link>
          <Link to="/signup" className="btn btn-primary btn-pill landing-signup">
            Get started
          </Link>
          <button
            type="button"
            className="landing-menu-button"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="landing-mobile-navigation"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open ? (
        <nav id="landing-mobile-navigation" className="shell-width landing-mobile-nav" aria-label="Mobile landing page">
          <a href="#services" onClick={close}>Services</a>
          <a href="#how-it-works" onClick={close}>How it works</a>
          <a href="#servmates" onClick={close}>For ServMates</a>
          <a href="#safety" onClick={close}>Safety</a>
          <a href="#faq" onClick={close}>Help &amp; support</a>
          <Link to="/login" onClick={close}>Log in</Link>
        </nav>
      ) : null}
    </header>
  );
}

export function WelcomePage() {
  return (
    <div className="landing-page">
      <a href="#main-content" className="landing-skip-link">Skip to main content</a>
      <LandingHeader />
      <main id="main-content">
        <section className="shell-width landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-story">
            <img
              src="/assets/photos/hero_welcome.jpg"
              alt="A person carefully assembling a wooden cabinet in a sunlit living room"
              className="landing-hero-image"
              width="1376"
              height="768"
              fetchPriority="high"
            />
            <p className="landing-hero-tagline">Good people. Everyday tasks,<br />taken care of.</p>
            <p className="landing-hero-copy">
              A helping hand, close to home. Find local help or share your skills with your neighborhood.
            </p>
            <p className="landing-hero-note">Local skills. A little peace of mind.</p>
          </div>
          <div className="landing-hero-action">
            <span className="chip">Your neighborhood, in one place</span>
            <h1 id="landing-title">Find help.<br />Share your skills.</h1>
            <p>Book local help or manage your ServMate work from the same account.</p>
            <InstallCta />
            <a href="#services" className="landing-text-link">
              Explore what you can book <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section id="services" className="landing-section shell-width" aria-labelledby="services-title">
          <div className="landing-section-heading">
            <div>
              <p className="eyebrow">Help around the home</p>
              <h2 id="services-title">What needs doing?</h2>
            </div>
            <p>From the task you keep putting off to the skill you need today, start with a category.</p>
          </div>
          <div className="landing-service-grid">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <Link
                  key={service.name}
                  to={`/app/categories/${encodeURIComponent(service.name)}`}
                  className="landing-service-card"
                >
                  <div className="landing-service-top">
                    <span className="landing-icon-box"><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>
                    <ArrowUpRight size={18} strokeWidth={1.6} aria-hidden="true" />
                  </div>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <section id="how-it-works" className="landing-band" aria-labelledby="how-title">
          <div className="shell-width landing-section">
            <div className="landing-section-heading">
              <div>
                <p className="eyebrow">A clear way to get help</p>
                <h2 id="how-title">From to-do to done.</h2>
              </div>
              <p>No guesswork about what happens next. Your booking keeps the details, conversation and progress together.</p>
            </div>
            <ol className="landing-steps">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <span className="landing-step-number">0{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
            <div className="landing-inline-note">
              <CalendarDays size={19} strokeWidth={1.7} aria-hidden="true" />
              <p><strong>Your time matters.</strong> Choose from the availability a ServMate publishes, then keep any schedule changes in the booking.</p>
            </div>
          </div>
        </section>

        <section id="servmates" className="landing-section shell-width" aria-labelledby="servmates-title">
          <div className="landing-split">
            <figure className="landing-photo-panel">
              <img
                src="/assets/photos/service_assembly.jpg"
                alt="A person using a screwdriver to assemble furniture"
                width="1024"
                height="1024"
                loading="lazy"
              />
              <figcaption>Your skills can make someone’s day a little lighter.</figcaption>
            </figure>
            <div className="landing-split-content">
              <p className="eyebrow">For ServMates</p>
              <h2 id="servmates-title">Good work deserves a place to grow.</h2>
              <p className="landing-lead">
                Turn what you do well into local work. Your ServMate workspace brings your services, schedule, requests and customer conversations into one place.
              </p>
              <ul className="landing-check-list">
                <li><Check size={17} aria-hidden="true" /><span><strong>You set the terms.</strong> Choose your hourly rate, minimum hours, working times and service area.</span></li>
                <li><Check size={17} aria-hidden="true" /><span><strong>You choose the work.</strong> Review each request before accepting it and ask questions in the booking conversation.</span></li>
                <li><Check size={17} aria-hidden="true" /><span><strong>You build a real record.</strong> Completed jobs and reviews from actual bookings give customers useful context.</span></li>
              </ul>
              <Link to="/mate/apply" className="btn btn-primary btn-pill landing-fit-button">
                Become a ServMate <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <p className="landing-small-note">Identity verification is required before your first paid job.</p>
            </div>
          </div>
        </section>

        <section id="safety" className="landing-section shell-width" aria-labelledby="safety-title">
          <div className="landing-section-heading">
            <div>
              <p className="eyebrow">Trust, in the open</p>
              <h2 id="safety-title">A little more peace of mind.</h2>
            </div>
            <p>Useful information, private details handled carefully and a clear route to support.</p>
          </div>
          <div className="landing-trust-grid">
            <article>
              <BadgeCheck size={23} strokeWidth={1.6} aria-hidden="true" />
              <h3>Verification you can understand</h3>
              <p>ServEm reviews ServMate identity information before paid work. You see the status, not the sensitive documents behind it.</p>
            </article>
            <article>
              <MessagesSquare size={23} strokeWidth={1.6} aria-hidden="true" />
              <h3>Details stay in the booking</h3>
              <p>Your exact address stays hidden until a request is accepted. Messages and booking updates remain together for easy reference.</p>
            </article>
            <article>
              <ShieldCheck size={23} strokeWidth={1.6} aria-hidden="true" />
              <h3>Reviews from real bookings</h3>
              <p>Only someone who completed a booking can review it. If a problem comes up, support has a documented dispute process to follow.</p>
            </article>
          </div>
        </section>

        <section className="landing-band" aria-labelledby="pricing-title">
          <div className="shell-width landing-section landing-pricing">
            <div>
              <p className="eyebrow">Clear pricing in pesos</p>
              <h2 id="pricing-title">Know the estimate before you ask.</h2>
              <p className="landing-lead">
                Every listing shows its hourly rate and minimum hours. Before you send a request, ServEm shows the labour subtotal and the 10% service fee as separate lines.
              </p>
              <div className="landing-payment-list" aria-label="Available payment methods">
                <span>GCash</span><span>Maya</span><span>Bank transfer</span><span>Cash on completion</span>
              </div>
              <p className="landing-small-note">Payment is collected after acceptance. Cash is paid when the visit is complete.</p>
            </div>
            <div className="landing-receipt" aria-label="Example booking price calculation">
              <div className="landing-receipt-heading">
                <div>
                  <span>Example booking</span>
                  <strong>Furniture assembly</strong>
                </div>
                <Banknote size={23} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <dl>
                <div><dt>Labour · ₱450 × 2 hours</dt><dd>₱900.00</dd></div>
                <div><dt>ServEm service fee · 10%</dt><dd>₱90.00</dd></div>
                <div className="landing-receipt-total"><dt>Estimated total</dt><dd>₱990.00</dd></div>
              </dl>
              <p>An illustrative calculation, not a live listing or quote. Your accepted rate and recorded hours determine the final amount.</p>
            </div>
          </div>
        </section>

        <section id="faq" className="landing-section shell-width" aria-labelledby="faq-title">
          <div className="landing-faq-layout">
            <div className="landing-faq-intro">
              <p className="eyebrow">Good to know</p>
              <h2 id="faq-title">Questions, answered plainly.</h2>
              <p>Everything you need before booking help or sharing your skills.</p>
              <Link to="/app/help" className="landing-text-link">Visit the help center <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
            <div className="landing-faq-list">
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0}>
                  <summary>{faq.question}<ChevronDown size={18} aria-hidden="true" /></summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="shell-width landing-final-cta" aria-labelledby="final-cta-title">
          <div>
            <p className="eyebrow">Your neighborhood, in one place</p>
            <h2 id="final-cta-title">Ready when you are.</h2>
            <p>Find a helping hand. Or become one.</p>
          </div>
          <div className="landing-final-actions">
            <Link to="/signup" className="btn btn-primary btn-pill">Get started <ArrowRight size={17} aria-hidden="true" /></Link>
            <Link to="/mate/apply" className="btn btn-outline btn-pill">Share your skills</Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="shell-width landing-footer-grid">
          <div className="landing-footer-brand">
            <Logo />
            <p>Good people. Everyday tasks, taken care of.</p>
            <span>Local skills. A little peace of mind.</span>
          </div>
          <nav aria-label="Services">
            <h2>Find help</h2>
            <a href="#services">Browse services</a>
            <Link to="/signup">Create an account</Link>
            <Link to="/login">Log in</Link>
          </nav>
          <nav aria-label="ServMate resources">
            <h2>Share your skills</h2>
            <Link to="/mate/apply">Become a ServMate</Link>
            <a href="#how-it-works">How bookings work</a>
            <a href="#pricing-title">Pricing &amp; payments</a>
          </nav>
          <nav aria-label="Support and legal">
            <h2>Support</h2>
            <a href="#faq">Common questions</a>
            <Link to="/app/help">Help center</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </nav>
        </div>
        <div className="shell-width landing-footer-bottom">
          <p>© {currentYear} ServEm PH. Built for neighborhoods across the Philippines.</p>
          <p>Personal data is handled under the Data Privacy Act of 2012 (RA 10173).</p>
        </div>
      </footer>
    </div>
  );
}
