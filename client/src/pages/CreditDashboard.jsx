import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import '../styles/credit.css';

// ── Helpers ──────────────────────────────────────────────────────────────────
const BAND_LABELS = ['', 'Insufficient', 'Thin', 'Moderate', 'Good', 'Excellent'];
const BAND_CLASS  = ['', 'ss-band-1',   'ss-band-2', 'ss-band-3', 'ss-band-4', 'ss-band-5'];


function ScoreRing({ band = 1, overall = 0 }) {
  const pct = Math.round((overall / 100) * 100);
  return (
    <div
      className={`ss-score-ring ${BAND_CLASS[band]}`}
      style={{ '--score-pct': `${pct}%` }}
    >
      <span className="ss-score-number">{band}</span>
      <span className="ss-score-label">{BAND_LABELS[band]}</span>
    </div>
  );
}

function ComponentBar({ label, value }) {
  return (
    <div className="ss-bar-row">
      <span className="ss-bar-label">{label}</span>
      <div className="ss-bar-track">
        <div className="ss-bar-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="ss-bar-value">{value}</span>
    </div>
  );
}

function AttestationCard({ attestation, onRevoke }) {
  const now = new Date();
  const expired = new Date(attestation.expiresAt) < now;
  const badge = attestation.revoked ? 'revoked' : expired ? 'expired' : 'active';

  return (
    <div className="ss-attest-card">
      <div className="ss-attest-header">
        <div>
          <div className="ss-attest-lender">{attestation.lenderName || attestation.lenderIdentifier}</div>
          <div className="ss-attest-id">{attestation.attestationId}</div>
        </div>
        <span className={`ss-badge ss-badge-${badge}`}>
          {badge.charAt(0).toUpperCase() + badge.slice(1)}
        </span>
      </div>
      <div className="ss-attest-meta">
        <div className="ss-attest-stat">
          Score: <strong>{BAND_LABELS[attestation.scoreBand]}</strong>
        </div>
        <div className="ss-attest-stat">
          Expires: <strong>{new Date(attestation.expiresAt).toLocaleDateString()}</strong>
        </div>
      </div>
      {!attestation.revoked && !expired && (
        <button
          onClick={() => onRevoke(attestation.attestationId)}
          style={{
            marginTop: 10,
            fontSize: 12,
            color: 'var(--danger)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            padding: 0,
          }}
        >
          Revoke access
        </button>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CreditDashboard() {
  const [profile, setProfile]       = useState(null);
  const [attestations, setAttestations] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);

  // Proof generation state
  const [showProofForm, setShowProofForm]   = useState(false);
  const [lenderInput, setLenderInput]       = useState('');
  const [lenderName, setLenderName]         = useState('');
  const [proofResult, setProofResult]       = useState(null);
  const [proofLoading, setProofLoading]     = useState(false);
  const [proofError, setProofError]         = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, attestRes] = await Promise.all([
        api.get('/safiscore/profile'),
        api.get('/safiscore/attestations'),
      ]);
      setProfile(profileRes.data);
      setAttestations(attestRes.data.attestations || []);
    } catch (err) {
      if (err.response?.status === 404) {
        // Profile doesn't exist yet — show consent prompt
        setProfile(null);
      } else {
        setError('Failed to load credit profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleConsent = async () => {
    try {
      await api.post('/safiscore/consent');
      await loadData();
    } catch {
      setError('Failed to record consent. Please try again.');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post('/safiscore/profile/refresh');
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateProof = async (e) => {
    e.preventDefault();
    if (!lenderInput.trim()) return;
    setProofLoading(true);
    setProofError(null);
    setProofResult(null);
    try {
      const res = await api.post('/safiscore/generate-proof', {
        lenderIdentifier: lenderInput.trim(),
        lenderName:       lenderName.trim() || undefined,
      });
      setProofResult(res.data);
      await loadData(); // refresh attestation list
    } catch (err) {
      setProofError(err.response?.data?.error || 'Failed to generate proof.');
    } finally {
      setProofLoading(false);
    }
  };

  const handleRevoke = async (attestationId) => {
    if (!window.confirm('Revoke this attestation? The lender will no longer be able to verify your score.')) return;
    try {
      await api.delete(`/safiscore/attestations/${attestationId}`);
      setAttestations(prev => prev.map(a =>
        a.attestationId === attestationId ? { ...a, revoked: true } : a
      ));
    } catch {
      alert('Failed to revoke. Please try again.');
    }
  };

  if (loading) {
    return <div className="sp-loading"><div className="sp-spinner" /></div>;
  }

  // ── No consent yet ────────────────────────────────────────────────────────
  if (!profile || !profile.consentGiven) {
    return (
      <div className="sp-animate-stagger">
        <div style={{ marginBottom: 24 }}>
          <div className="sp-section-label" style={{ marginBottom: 4 }}>SafiScore</div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Your Credit Profile</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            Turn your purchase history into a verifiable credit signal.
          </p>
        </div>

        <div className="ss-consent-banner">
          <div className="ss-consent-title">Activate Your SafiScore</div>
          <div className="ss-consent-body">
            SafiScore uses your anonymised retail transaction history to build a verifiable
            credit profile. No raw data is ever shared with lenders — only cryptographic
            proofs of your spending patterns.
          </div>
          <button className="sp-btn sp-btn-primary" style={{ fontSize: 14 }} onClick={handleConsent}>
            Activate SafiScore
          </button>
        </div>

        <div className="sp-card">
          <div className="sp-section-label" style={{ marginBottom: 12 }}>How it works</div>
          {[
            ['🛒 Shop normally', 'Every purchase at a SafiPoints merchant creates a private, cryptographically attested transaction record.'],
            ['📊 Build your profile', 'SafiScore analyses consistency, depth, and diversity of your retail history over time.'],
            ['🔒 Share selectively', 'When you apply for a loan, generate a time-limited proof. The lender verifies your score — without seeing your transactions.'],
          ].map(([title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 24, lineHeight: 1 }}>{title.split(' ')[0]}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{title.slice(3)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { scoreBand, scoreBandLabel, scoreBreakdown, monthsOfHistory, totalTransactions, uniqueMerchants, lastTransactionAt } = profile;

  return (
    <div className="sp-animate-stagger">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div className="sp-section-label" style={{ marginBottom: 4 }}>SafiScore</div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Credit Profile</h2>
        </div>
        <button
          className="sp-btn sp-btn-ghost"
          style={{ fontSize: 12 }}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing…' : 'Refresh score'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Score card ───────────────────────────────────────────────── */}
      <div className="sp-card" style={{ marginBottom: 20, textAlign: 'center' }}>
        <ScoreRing band={scoreBand} overall={scoreBreakdown?.overall || 0} />
        <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{scoreBandLabel}</p>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
          Overall score: {scoreBreakdown?.overall || 0}/100
        </p>

        {/* Component breakdown */}
        <div style={{ textAlign: 'left' }}>
          <div className="sp-section-label" style={{ marginBottom: 12 }}>Score breakdown</div>
          <ComponentBar label="Consistency" value={scoreBreakdown?.consistency || 0} />
          <ComponentBar label="Recency"     value={scoreBreakdown?.recency || 0} />
          <ComponentBar label="Depth"       value={scoreBreakdown?.depth || 0} />
          <ComponentBar label="Diversity"   value={scoreBreakdown?.diversity || 0} />
          <ComponentBar label="Trend"       value={scoreBreakdown?.volumeTrend || 0} />
        </div>
      </div>

      {/* ── Stats grid ───────────────────────────────────────────────── */}
      <div className="ss-stat-grid">
        <div className="ss-stat-box sp-card" style={{ padding: 16 }}>
          <div className="ss-stat-value">{monthsOfHistory}</div>
          <div className="ss-stat-label">Months of history</div>
        </div>
        <div className="ss-stat-box sp-card" style={{ padding: 16 }}>
          <div className="ss-stat-value">{totalTransactions}</div>
          <div className="ss-stat-label">Total transactions</div>
        </div>
        <div className="ss-stat-box sp-card" style={{ padding: 16 }}>
          <div className="ss-stat-value">{uniqueMerchants}</div>
          <div className="ss-stat-label">Unique merchants</div>
        </div>
        <div className="ss-stat-box sp-card" style={{ padding: 16 }}>
          <div className="ss-stat-value">
            {lastTransactionAt ? Math.round((Date.now() - new Date(lastTransactionAt).getTime()) / (24 * 60 * 60 * 1000)) : '—'}
          </div>
          <div className="ss-stat-label">Days since last tx</div>
        </div>
      </div>

      {/* ── Generate proof ───────────────────────────────────────────── */}
      <div className="sp-card" style={{ marginBottom: 20 }}>
        <div className="sp-section-label" style={{ marginBottom: 4 }}>Share with a lender</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          Generate a 30-day cryptographic proof for a specific lender.
          They verify your score without seeing your transactions.
        </p>

        {!showProofForm && !proofResult && (
          <button
            className="sp-btn sp-btn-gold"
            style={{ width: '100%' }}
            onClick={() => setShowProofForm(true)}
          >
            Generate proof for a lender
          </button>
        )}

        {showProofForm && !proofResult && (
          <form onSubmit={handleGenerateProof}>
            <div className="sp-form-group">
              <label className="sp-label">Lender identifier *</label>
              <input
                className="sp-input"
                type="text"
                placeholder="e.g. faulu-kenya or lender@example.com"
                value={lenderInput}
                onChange={e => setLenderInput(e.target.value)}
                required
              />
            </div>
            <div className="sp-form-group" style={{ marginTop: 12 }}>
              <label className="sp-label">Lender name (optional)</label>
              <input
                className="sp-input"
                type="text"
                placeholder="e.g. Faulu Kenya MFI"
                value={lenderName}
                onChange={e => setLenderName(e.target.value)}
              />
            </div>
            {proofError && (
              <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{proofError}</p>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button type="submit" className="sp-btn sp-btn-gold" style={{ flex: 1 }} disabled={proofLoading}>
                {proofLoading ? 'Generating…' : 'Generate proof'}
              </button>
              <button
                type="button"
                className="sp-btn sp-btn-ghost"
                onClick={() => { setShowProofForm(false); setProofError(null); }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {proofResult && (
          <div className="ss-share-box">
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              ✓ Proof generated — share this link with your lender
            </p>
            <p className="ss-share-url">{proofResult.shareUrl}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                className="sp-btn sp-btn-gold"
                style={{ flex: 1, fontSize: 13 }}
                onClick={() => navigator.clipboard.writeText(proofResult.shareUrl)}
              >
                Copy link
              </button>
              <button
                className="sp-btn sp-btn-ghost"
                style={{ fontSize: 13 }}
                onClick={() => { setProofResult(null); setShowProofForm(false); setLenderInput(''); setLenderName(''); }}
              >
                Done
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
              Expires: {new Date(proofResult.expiresAt).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {/* ── Active attestations ──────────────────────────────────────── */}
      {attestations.length > 0 && (
        <div className="sp-card" style={{ marginBottom: 20 }}>
          <div className="sp-section-label" style={{ marginBottom: 16 }}>Shared attestations</div>
          {attestations.map(a => (
            <AttestationCard key={a._id} attestation={a} onRevoke={handleRevoke} />
          ))}
        </div>
      )}

      {/* ── Nav to wallet ────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', paddingBottom: 24 }}>
        <Link to="/wallet" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          ← Back to rewards wallet
        </Link>
      </div>
    </div>
  );
}
