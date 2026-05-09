import { Link } from 'react-router-dom';

const HOW_IT_WORKS = [
  {
    num: '01',
    title: 'Shop normally',
    desc: 'Every purchase at a SafiPoints merchant creates a private, cryptographically attested transaction record on the XRP Ledger.',
  },
  {
    num: '02',
    title: 'Build your profile',
    desc: 'SafiScore analyses consistency, recency, depth, and diversity of your retail history to produce a verifiable credit signal.',
  },
  {
    num: '03',
    title: 'Share selectively',
    desc: 'When you apply for credit, generate a 30-day signed attestation for that lender. They verify your score — never your raw transactions.',
  },
];

const FOR_LENDERS = [
  {
    icon: '✦',
    title: 'Reach thin-file applicants',
    body: 'Access credit signals for expatriates and new-to-bank customers who have no AECB history but demonstrable retail spending patterns.',
  },
  {
    icon: '⬡',
    title: 'Cryptographic verification',
    body: 'Every attestation is HMAC-SHA256 signed and anchored to the XRP Ledger. Tamper-evident, auditable, and revocable by the customer.',
  },
  {
    icon: '◎',
    title: 'Privacy-preserving',
    body: 'Raw transaction data never leaves the customer\'s control. Lenders receive only the score band and anonymised behavioural signals.',
  },
];

export default function Landing() {
  return (
    <div className="land">
      {/* ── Nav ──────────────────────────────────────── */}
      <nav className="land-nav">
        <Link to="/" className="land-logo">
          <span className="land-logo-dot" />
          SafiScore
        </Link>
        <div className="land-nav-links">
          <Link to="/login" className="land-nav-signin">Sign In</Link>
          <Link to="/register" className="sp-btn sp-btn-gold sp-btn-sm">Build my profile</Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="land-hero">
        <div className="land-hero-images">
          <img src="/images/hero-1.avif" alt="" className="land-hero-img" />
          <img src="/images/hero-2.avif" alt="" className="land-hero-img" />
        </div>
        <div className="land-hero-overlay" />
        <div className="land-hero-inner">
          <p className="land-kicker">Alternative Credit Intelligence · UAE</p>

          <h1 className="land-title">
            Your spending history<br />
            <span className="land-title-gold">is your credit score.</span>
          </h1>

          <p className="land-subtitle">
            SafiScore turns anonymised retail transaction data into a verifiable credit
            profile — no bureau history required. Built for the UAE's thin-file majority.
          </p>

          <div className="land-ctas">
            <Link to="/register" className="sp-btn sp-btn-gold sp-btn-lg">
              Build my profile
            </Link>
            <Link to="/m/alfanar" className="sp-btn sp-btn-lg land-btn-outline">
              See a demo
            </Link>
          </div>

          <div className="land-hero-badges">
            <span className="land-badge">XRPL-anchored</span>
            <span className="land-badge">HMAC-signed attestations</span>
            <span className="land-badge">No raw data shared</span>
          </div>
        </div>
      </section>

      {/* ── Score preview strip ───────────────────────── */}
      <section className="land-score-strip">
        <div className="land-score-strip-inner">
          {[
            { band: '1', label: 'Insufficient', sub: '0–1 transactions' },
            { band: '2', label: 'Thin',         sub: 'Early history' },
            { band: '3', label: 'Moderate',     sub: 'Growing profile' },
            { band: '4', label: 'Good',         sub: 'Consistent spender' },
            { band: '5', label: 'Excellent',    sub: 'Deep, diverse history' },
          ].map(({ band, label, sub }) => (
            <div key={band} className={`land-band land-band-${band}`}>
              <div className="land-band-num">{band}</div>
              <div className="land-band-label">{label}</div>
              <div className="land-band-sub">{sub}</div>
            </div>
          ))}
        </div>
        <p className="land-score-caption">SafiScore bands — 1 (Insufficient) to 5 (Excellent)</p>
      </section>

      {/* ── How it works ─────────────────────────────── */}
      <section className="land-steps">
        <h2 className="land-section-title">How it works</h2>
        <div className="land-steps-grid land-steps-grid--3">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.num} className="land-step">
              <div className="land-step-num">{s.num}</div>
              <h3 className="land-step-title">{s.title}</h3>
              <p className="land-step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── For lenders ──────────────────────────────── */}
      <section className="land-why">
        <div className="land-why-inner">
          <p className="land-section-title">For financial institutions</p>
          <h2 className="land-lender-heading">
            Verified credit signals for applicants with no bureau history.
          </h2>
          <div className="land-why-grid">
            {FOR_LENDERS.map(({ icon, title, body }) => (
              <div key={title} className="land-why-item">
                <div className="land-why-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
          <div className="land-lender-cta">
            <p className="land-lender-disclaimer">
              SafiScore attestations are supplementary credit signals. They are not issued by or affiliated with the Al Etihad Credit Bureau (AECB) or the Central Bank of the UAE. All credit decisions remain the sole responsibility of the lending institution.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="land-footer">
        <span>SafiScore</span>
        <span className="land-footer-sep">&middot;</span>
        <span>Built on XRPL</span>
        <span className="land-footer-sep">&middot;</span>
        <span>UAE Alternative Credit Intelligence</span>
        <span className="land-footer-sep">&middot;</span>
        <span>{new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
