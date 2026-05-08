import { Link } from 'react-router-dom';

const steps = [
  { num: '1', title: 'Scan', desc: 'Customer scans your QR code' },
  { num: '2', title: 'Order & Pay', desc: 'Browse menu, place order, pay' },
  { num: '3', title: 'Earn SAFI', desc: 'Cashback minted on XRPL instantly' },
  { num: '4', title: 'Redeem', desc: 'Use SAFI for discounts next visit' },
];

export default function Landing() {
  return (
    <div className="land">
      {/* ── Nav ──────────────────────────────────────── */}
      <nav className="land-nav">
        <Link to="/" className="land-logo">
          <span className="land-logo-dot" />
          SafiPoints
        </Link>
        <div className="land-nav-links">
          <Link to="/login" className="land-nav-signin">Sign In</Link>
          <Link to="/register" className="sp-btn sp-btn-gold sp-btn-sm">Get Started</Link>
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
          <p className="land-kicker">Blockchain loyalty for Commerce</p>

          <h1 className="land-title">
            Your customers deserve<br />
            <span className="land-title-gold">more than a receipt.</span>
          </h1>

          <p className="land-subtitle">
            Every order earns cashback. Customers spend it on their next visit.
            No app. No card. Just scan and go.
          </p>

          <div className="land-ctas">
            <Link to="/register" className="sp-btn sp-btn-gold sp-btn-lg">
              Get Started
            </Link>
            <Link to="/m/kilimanajaro" className="sp-btn sp-btn-lg land-btn-outline">
              Try the Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────── */}
      <section className="land-steps">
        <h2 className="land-section-title">How it works</h2>
        <div className="land-steps-grid">
          {steps.map((s) => (
            <div key={s.num} className="land-step">
              <div className="land-step-num">{s.num}</div>
              <h3 className="land-step-title">{s.title}</h3>
              <p className="land-step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why ──────────────────────────────────────── */}
      <section className="land-why">
        <div className="land-why-inner">
          <h2 className="land-section-title">Why SafiPoints?</h2>
          <div className="land-why-grid">
            <div className="land-why-item">
              <div className="land-why-icon">✦</div>
              <h3>Transparent</h3>
              <p>Every point is an XRPL token. Customers can verify balances on-chain.</p>
            </div>
            <div className="land-why-item">
              <div className="land-why-icon">→</div>
              <h3>Zero friction</h3>
              <p>No app download. Scan a QR, order, earn. Wallet is created automatically.</p>
            </div>
            <div className="land-why-item">
              <div className="land-why-icon">↻</div>
              <h3>Instant redemption</h3>
              <p>Toggle SAFI at checkout to apply discounts. No codes, no cards.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="land-footer">
        <span>SafiPoints</span>
        <span className="land-footer-sep">&middot;</span>
        <span>Built on XRPL</span>
        <span className="land-footer-sep">&middot;</span>
        <span>{new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
