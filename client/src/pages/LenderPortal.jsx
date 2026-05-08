/**
 * LenderPortal — public-facing verification page for lenders.
 *
 * Two entry points:
 *   1. /verify/:attestationId  — direct from a customer's share link (auto-populates ID)
 *   2. /lender               — manual lookup form for lenders
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import '../styles/credit.css';

const BAND_LABELS = ['', 'Insufficient', 'Thin', 'Moderate', 'Good', 'Excellent'];
const BAND_COLORS = ['', '#EF4444', '#F59E0B', '#FBBF24', '#10B981', '#059669'];

function Stars({ band }) {
  return (
    <div className="ss-stars">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`ss-star ${i <= band ? 'ss-star-filled' : 'ss-star-empty'}`}>
          ★
        </span>
      ))}
    </div>
  );
}

function VerificationResult({ result }) {
  if (!result.valid) {
    return (
      <div className="ss-result-invalid">
        <div className="ss-result-title" style={{ color: 'var(--danger)' }}>
          ✗ Attestation Invalid
        </div>
        <p style={{ fontSize: 14, color: '#991B1B' }}>
          {result.reason}
          {result.expiredAt && <> (expired {new Date(result.expiredAt).toLocaleDateString()})</>}
          {result.revokedAt && <> (revoked {new Date(result.revokedAt).toLocaleDateString()})</>}
        </p>
        <p style={{ fontSize: 13, color: '#991B1B', marginTop: 8 }}>
          Ask the applicant to generate a new attestation.
        </p>
      </div>
    );
  }

  const { attestation } = result;
  const band = attestation.scoreBand;

  return (
    <div className="ss-result-valid">
      <div className="ss-result-title" style={{ color: 'var(--success)' }}>
        ✓ Attestation Verified
      </div>

      {/* Score */}
      <div style={{ textAlign: 'center', padding: '16px 0', borderBottom: '1px solid #D1FAE5', marginBottom: 20 }}>
        <Stars band={band} />
        <div style={{ fontSize: 28, fontWeight: 900, color: BAND_COLORS[band], marginTop: 4 }}>
          {BAND_LABELS[band]}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Score band {band} of 5
        </div>
      </div>

      {/* Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          ['Months of history', attestation.monthsOfHistory ?? '—'],
          ['Merchant diversity', attestation.merchantDiversity ?? '—'],
          ['Spend band', (attestation.spendBand || '—').replace('_', ' ')],
          ['Freshness', `${attestation.freshnessScore ?? '—'} days`],
        ].map(([label, value]) => (
          <div key={label} style={{ background: '#F0FDF4', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
              {label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#047857' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Proof info */}
      <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Proof integrity
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', wordBreak: 'break-all', lineHeight: 1.6 }}>
          {attestation.proofHash}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Issued: {new Date(attestation.issuedAt).toLocaleDateString()}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Expires: {new Date(attestation.expiresAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

export default function LenderPortal() {
  const { attestationId: urlId } = useParams();

  const [inputId, setInputId]     = useState(urlId || '');
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // Auto-verify when arriving via a share link (/verify/:id)
  useEffect(() => {
    if (urlId && /^[a-f0-9]{64}$/.test(urlId)) {
      verify(urlId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlId]);

  const verify = async (id) => {
    const cleaned = (id || inputId).trim();
    if (!cleaned) return;
    if (!/^[a-f0-9]{64}$/.test(cleaned)) {
      setError('Invalid attestation ID — must be a 64-character hex string.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.get(`/safiscore/verify/${cleaned}`);
      setResult(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setResult({ valid: false, reason: 'Attestation not found' });
      } else {
        setError('Verification service error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    verify(inputId);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="ss-verify-hero">
        <div className="ss-verify-title">SafiScore Lender Portal</div>
        <div className="ss-verify-subtitle">
          Verify a customer's credit attestation in seconds — no phone calls, no paper.
        </div>
      </div>

      {/* ── Lookup form ──────────────────────────────────────────────── */}
      <div className="sp-card" style={{ marginBottom: 20 }}>
        <div className="sp-section-label" style={{ marginBottom: 12 }}>Verify an attestation</div>
        <form onSubmit={handleSubmit}>
          <div className="sp-form-group">
            <label className="sp-label">Attestation ID</label>
            <input
              className="sp-input"
              type="text"
              placeholder="64-character hex ID from the customer's share link"
              value={inputId}
              onChange={e => setInputId(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
              required
            />
          </div>
          {error && (
            <p style={{ fontSize: 13, color: 'var(--danger)', marginTop: 8 }}>{error}</p>
          )}
          <button
            type="submit"
            className="sp-btn sp-btn-primary"
            style={{ width: '100%', marginTop: 16 }}
            disabled={loading}
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </form>
      </div>

      {/* ── Result ───────────────────────────────────────────────────── */}
      {result && <VerificationResult result={result} />}

      {/* ── How to use ───────────────────────────────────────────────── */}
      {!result && (
        <div className="sp-card">
          <div className="sp-section-label" style={{ marginBottom: 12 }}>How to use</div>
          {[
            ['1', 'Request a SafiScore proof from your loan applicant.'],
            ['2', 'They generate a share link via the SafiScore app and send it to you.'],
            ['3', 'Paste the 64-character attestation ID above and click Verify.'],
            ['4', 'You see their score band, history depth, and merchant diversity — nothing more.'],
          ].map(([num, text]) => (
            <div key={num} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--navy)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, flexShrink: 0,
              }}>
                {num}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
