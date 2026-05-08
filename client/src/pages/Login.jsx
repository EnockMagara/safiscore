import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const location = useLocation();
  const fromClaim = Boolean(location.state?.fromClaim);
  const [tab, setTab] = useState(fromClaim ? 'customer' : 'merchant');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(location.state?.claimPhone || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginMerchant, loginCustomer } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'merchant') {
        await loginMerchant({ email, password });
        navigate('/dashboard');
      } else {
        await loginCustomer({ phone });
        navigate('/wallet');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sp-auth-page">
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link to="/" style={{
            textDecoration: 'none', fontWeight: 800, fontSize: 22,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #EFBF4A, #F5D07A)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            SafiPoints
          </Link>
        </div>

        <div className="sp-card" style={{ padding: 32 }}>
          <h2 className="sp-auth-title">Welcome back</h2>
          <p className="sp-auth-subtitle">Access your loyalty performance workspace</p>

          <div className="sp-tab-row">
            <button className={`sp-tab ${tab === 'merchant' ? 'active' : ''}`} onClick={() => setTab('merchant')}>
              Business Account
            </button>
            <button className={`sp-tab ${tab === 'customer' ? 'active' : ''}`} onClick={() => setTab('customer')}>
              Customer Account
            </button>
          </div>

          {fromClaim && tab === 'customer' && (
            <p style={{
              margin: '0 0 16px',
              padding: '12px 14px',
              borderRadius: 10,
              fontSize: 14,
              lineHeight: 1.45,
              color: 'var(--text-primary)',
              background: 'var(--success-bg)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
            }}>
              Your cashback is in your wallet. Sign in with the <strong>same phone</strong> you used on the claim page (no password in this demo).
            </p>
          )}

          {error && <div className="sp-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {tab === 'merchant' ? (
              <>
                <div className="sp-form-group">
                  <label className="sp-label">Email</label>
                  <input className="sp-input" type="email" placeholder="you@restaurant.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="sp-form-group">
                  <label className="sp-label">Password</label>
                  <input className="sp-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
              </>
            ) : (
              <div className="sp-form-group">
                <label className="sp-label">Phone Number</label>
                <input className="sp-input" type="tel" placeholder="+254 7XX XXX XXX" value={phone} onChange={e => setPhone(e.target.value)} required />
              </div>
            )}

            <button type="submit" className="sp-btn sp-btn-primary" style={{ width: '100%', marginTop: 8, padding: '14px 24px' }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-tertiary)' }}>
            Need an account? <Link to="/register" className="sp-link">Set one up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
