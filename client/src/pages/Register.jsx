import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [tab, setTab] = useState('merchant');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', merchantId: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletInfo, setWalletInfo] = useState(null);
  const { registerMerchant, registerCustomer } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'merchant') {
        const res = await registerMerchant({
          name: form.name, email: form.email, password: form.password, phone: form.phone,
        });
        setWalletInfo({
          xrplAddress: res.merchant.xrplAddress,
          message: 'Your business loyalty account is ready.',
          redirect: '/dashboard',
        });
      } else {
        if (!form.merchantId) { setError('Merchant ID is required'); setLoading(false); return; }
        const res = await registerCustomer({
          name: form.name, phone: form.phone, email: form.email, merchantId: form.merchantId,
        });
        setWalletInfo({
          xrplAddress: res.customer.xrplAddress,
          trustTxHash: res.customer.trustTxHash,
          message: 'Your customer rewards account is now active.',
          redirect: '/wallet',
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Success State ─────────────────────────────────
  if (walletInfo) {
    return (
      <div className="sp-auth-page">
        <div className="sp-card" style={{ maxWidth: 440, width: '100%', textAlign: 'center', padding: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: '0 auto 20px',
            background: 'linear-gradient(135deg, rgba(239,191,74,0.1), rgba(239,191,74,0.2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
            Account Created
          </h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 24 }}>
            {walletInfo.message}
          </p>
          <div style={{
            background: '#F8F7F2', borderRadius: 10, padding: 16,
            fontFamily: '"SF Mono", monospace', fontSize: 12, letterSpacing: '0.01em',
            color: 'var(--text-secondary)', wordBreak: 'break-all',
            border: '1px solid #E5E7EB',
          }}>
            {walletInfo.xrplAddress}
          </div>
          {walletInfo.trustTxHash && (
            <a href={`https://testnet.xrpl.org/transactions/${walletInfo.trustTxHash}`}
               target="_blank" rel="noreferrer"
               style={{ display: 'block', marginTop: 16, fontSize: 13, color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>
              View verification record →
            </a>
          )}
          <button onClick={() => navigate(walletInfo.redirect)} className="sp-btn sp-btn-primary" style={{ width: '100%', marginTop: 28, padding: '14px' }}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ── Registration Form ─────────────────────────────
  return (
    <div className="sp-auth-page">
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link to="/" style={{
            textDecoration: 'none', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #EFBF4A, #F5D07A)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            SafiPoints
          </Link>
        </div>

        <div className="sp-card" style={{ padding: 32 }}>
          <h2 className="sp-auth-title">Create account</h2>
          <p className="sp-auth-subtitle">Begin with a structured loyalty setup in minutes</p>

          <div className="sp-tab-row">
            <button className={`sp-tab ${tab === 'merchant' ? 'active' : ''}`} onClick={() => setTab('merchant')}>Business Account</button>
            <button className={`sp-tab ${tab === 'customer' ? 'active' : ''}`} onClick={() => setTab('customer')}>Customer Account</button>
          </div>

          {error && <div className="sp-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="sp-form-group">
              <label className="sp-label">{tab === 'merchant' ? 'Restaurant Name' : 'Full Name'}</label>
              <input className="sp-input" placeholder={tab === 'merchant' ? 'e.g. Kilimanjaro Grill' : 'e.g. Jane Wanjiku'} value={form.name} onChange={set('name')} required />
            </div>

            {tab === 'merchant' ? (
              <>
                <div className="sp-form-group">
                  <label className="sp-label">Email</label>
                  <input className="sp-input" type="email" placeholder="you@restaurant.com" value={form.email} onChange={set('email')} required />
                </div>
                <div className="sp-form-group">
                  <label className="sp-label">Password</label>
                  <input className="sp-input" type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} required minLength={6} />
                </div>
                <div className="sp-form-group">
                  <label className="sp-label">Phone (optional)</label>
                  <input className="sp-input" type="tel" placeholder="+254 7XX XXX XXX" value={form.phone} onChange={set('phone')} />
                </div>
              </>
            ) : (
              <>
                <div className="sp-form-group">
                  <label className="sp-label">Phone Number</label>
                  <input className="sp-input" type="tel" placeholder="+254 7XX XXX XXX" value={form.phone} onChange={set('phone')} required />
                </div>
                <div className="sp-form-group">
                  <label className="sp-label">Email (optional)</label>
                  <input className="sp-input" type="email" placeholder="you@email.com" value={form.email} onChange={set('email')} />
                </div>
                <div className="sp-form-group">
                  <label className="sp-label">Merchant ID</label>
                  <input className="sp-input" placeholder="Ask the restaurant for their ID" value={form.merchantId} onChange={set('merchantId')} required />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, display: 'block' }}>
                    Needed to connect your profile to the participating business
                  </span>
                </div>
              </>
            )}

            <button type="submit" className="sp-btn sp-btn-primary" style={{ width: '100%', marginTop: 8, padding: '14px' }} disabled={loading}>
              {loading ? 'Setting up your account...' : `Create ${tab === 'merchant' ? 'Business' : 'Customer'} Account`}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-tertiary)' }}>
            Already have an account? <Link to="/login" className="sp-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
