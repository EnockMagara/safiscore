import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../api/client';

export default function ClaimPage() {
  const { pendingId } = useParams();
  const navigate = useNavigate();

  const [claimInfo, setClaimInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  // Auto-fill OTP in demo mode
  useEffect(() => {
    if (claimInfo?.prototypeClaimMode && !otp) {
      setOtp('123456');
    }
  }, [claimInfo]); // eslint-disable-line react-hooks/exhaustive-deps
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get(`/integration/claim/${pendingId}`)
      .then(res => setClaimInfo(res.data))
      .catch(err => setLoadError(err.response?.data?.error || 'Claim link not found or expired.'));
  }, [pendingId]);

  const handleClaim = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post(`/integration/claim/${pendingId}`, { phone, otp });
      setSuccess({ ...res.data, submittedPhone: phone.trim() });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = phone.trim().length >= 9 && otp.replace(/\D/g, '').length === 6;

  // ── Error / expired ──────────────────────────────────────
  if (loadError) {
    return (
      <div className="cp-page">
        <div className="cp-card">
          <div className="cp-status-icon">⏰</div>
          <h2 className="cp-status-title">Link Expired</h2>
          <p className="cp-status-body">{loadError}</p>
          <button type="button" className="cp-btn cp-btn--gold" onClick={() => navigate('/')}>
            Back to SafiPoints
          </button>
        </div>
      </div>
    );
  }

  // ── Loading skeleton ─────────────────────────────────────
  if (!claimInfo) {
    return (
      <div className="cp-page">
        <div className="cp-card cp-card--loading">
          <div className="cp-loading-ring" />
          <p className="cp-loading-text">Loading your reward…</p>
        </div>
      </div>
    );
  }

  // ── Claim window closed ──────────────────────────────────
  if (!claimInfo.isClaimable) {
    return (
      <div className="cp-page">
        <div className="cp-card">
          <div className="cp-status-icon">⏰</div>
          <h2 className="cp-status-title">Claim Window Closed</h2>
          <p className="cp-status-body">
            These {claimInfo.safiAmount} SAFI (KES {claimInfo.kshCashback}) have expired.
            Future rewards can be claimed within 6 months of earning them.
          </p>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────
  if (success) {
    return (
      <div className="cp-page">
        <motion.div
          className="cp-card cp-card--success"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="cp-success-ring" aria-hidden>
            <span className="cp-success-check">✓</span>
          </div>
          <h1 className="cp-success-title">Cashback is in your wallet</h1>
          <p className="cp-success-lead">
            <strong>{success.safiMinted} SAFI</strong>
            {' '}(≈ KES {success.kshCashback}) is now on the blockchain under your new SafiPoints wallet.
          </p>

          <ol className="cp-next-steps">
            <li>
              <span className="cp-next-steps-num">1</span>
              <span>
                <strong>Verified on XRPL</strong> — your mint is a public transaction anyone can audit.
              </span>
            </li>
            <li>
              <span className="cp-next-steps-num">2</span>
              <span>
                <strong>Wallet linked to your phone</strong> — use the same number you entered above to access your wallet anytime.
              </span>
            </li>
          </ol>

          <div className="cp-info-row">
            <span className="cp-info-label">Wallet address</span>
            <code className="cp-wallet-addr">{success.xrplAddress}</code>
          </div>

          <a
            href={success.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="cp-explorer-link cp-explorer-link--btn"
          >
            View transaction on explorer ↗
          </a>

          <p className="cp-success-note">
            Cashback value is locked until{' '}
            {new Date(success.expiresAt).toLocaleDateString('en-KE', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>

          <div className="cp-success-actions">
            <button
              type="button"
              className="cp-btn cp-btn--navy"
              onClick={() => navigate('/login', {
                state: {
                  fromClaim: true,
                  claimPhone: success.submittedPhone,
                },
              })}
            >
              Open my wallet
            </button>
            <Link to="/" className="cp-link-subtle">
              Back to home
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Main claim form ──────────────────────────────────────
  return (
    <div className="cp-page">
      <motion.div
        className="cp-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="cp-brand">
          <span className="cp-brand-dot" />
          SafiPoints
        </div>

        <h1 className="cp-headline">You earned cashback!</h1>
        <p className="cp-sub">at <strong>{claimInfo.merchantName}</strong></p>

        <div className="cp-amount-block">
          <span className="cp-amount-safi">{claimInfo.safiAmount} SAFI</span>
          <span className="cp-amount-ksh">≈ KES {claimInfo.kshCashback} cashback</span>
        </div>

        <div className="cp-expiry-strip">
          <span className="cp-expiry-icon">⏳</span>
          Claim by{' '}
          <strong>
            {new Date(claimInfo.claimWindowExpiresAt).toLocaleDateString('en-KE', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </strong>
        </div>

        {claimInfo.prototypeClaimMode && (
          <div className="cp-demo-banner" role="note">
            <span className="cp-demo-banner-icon">✦</span>
            <div>
              <strong>Demo mode</strong>
              <p>Use the same phone you entered at checkout. Any 6-digit code is accepted.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleClaim} className="cp-form" noValidate>
          <div className="cp-field">
            <label className="cp-label" htmlFor="cp-phone">
              Phone number
            </label>
            {claimInfo.orderPhoneLast4 && (
              <p className="cp-field-hint">
                Same number you used when ordering (ends in <strong>{claimInfo.orderPhoneLast4}</strong>)
              </p>
            )}
            <div className="cp-input-wrap">
              <span className="cp-input-icon" aria-hidden>📱</span>
              <input
                id="cp-phone"
                type="tel"
                placeholder="+254 712 345 678"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="cp-input"
                autoComplete="tel"
                inputMode="tel"
              />
            </div>
          </div>

          <div className="cp-field">
            <label className="cp-label" htmlFor="cp-otp">
              One-time code
              <span className="cp-label-hint">
                {claimInfo.prototypeClaimMode ? '(demo: any 6 digits)' : '(from SMS)'}
              </span>
            </label>
            <input
              id="cp-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              className="cp-input cp-input--otp"
              aria-describedby="cp-otp-help"
            />
            <p id="cp-otp-help" className="cp-otp-help">
              {claimInfo.prototypeClaimMode
                ? 'Type any six numbers to continue — no SMS required in this demo.'
                : 'Enter the 6-digit code we sent to your phone.'}
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                className="cp-error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="alert"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            className="cp-btn cp-btn--gold cp-btn--lg"
            disabled={loading || !canSubmit}
          >
            {loading ? (
              <span className="cp-btn-spinner-wrap">
                <span className="cp-btn-spinner" />
                Sending to blockchain…
              </span>
            ) : (
              <>
                <span>Claim cashback</span>
                <span className="cp-btn-amount">KES {claimInfo.kshCashback}</span>
              </>
            )}
          </button>
        </form>

        <p className="cp-footnote">
          Creates a free XRPL wallet for you — no XRP purchase required. Secured by SafiPoints.
        </p>
      </motion.div>
    </div>
  );
}
