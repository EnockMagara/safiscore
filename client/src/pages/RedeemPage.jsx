import { useState, useEffect } from 'react';
import api from '../api/client';

export default function RedeemPage() {
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(null);
  const [redemption, setRedemption] = useState(null);
  const [confirmResult, setConfirmResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/customers/me').then(res => {
      setMerchants(res.data.enrolledMerchants || []);
      if (res.data.enrolledMerchants?.length > 0) {
        setSelectedMerchant(res.data.enrolledMerchants[0]._id);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedMerchant) return;
    api.get(`/customers/me/balance?merchantId=${selectedMerchant}`)
      .then(res => setBalance(res.data))
      .catch(() => setBalance(null));
  }, [selectedMerchant]);

  const handleInitiate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/loyalty/redeem/initiate', {
        merchantId: selectedMerchant,
        safiAmount: parseFloat(amount),
      });
      setRedemption(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Redemption failed');
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/loyalty/redeem/confirm', {
        code: redemption.code,
        orderId: `order_${Date.now()}`,
      });
      setConfirmResult(res.data);
      setRedemption(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Confirmation failed');
    } finally { setLoading(false); }
  };

  // ── Success State ─────────────────────────────────
  if (confirmResult) {
    return (
      <div>
        <h1 className="sp-page-title">Redemption Confirmed</h1>
        <div className="sp-card" style={{ textAlign: 'center', padding: 40, maxWidth: 480 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: '0 auto 20px',
            background: 'var(--success-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
            {confirmResult.discountAmount} KES
          </h2>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 20 }}>discount confirmed</p>
          <div className="sp-success">
            {confirmResult.safiBurned} SAFI redeemed · New balance: <strong>{confirmResult.newBalance} SAFI</strong>
          </div>
          {confirmResult.xrplTxHash && (
            <a href={`https://testnet.xrpl.org/transactions/${confirmResult.xrplTxHash}`}
               target="_blank" rel="noreferrer"
               style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13, color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>
              View verification record →
            </a>
          )}
          <button onClick={() => { setConfirmResult(null); setAmount(''); }}
            className="sp-btn sp-btn-primary" style={{ width: '100%', marginTop: 28, padding: '14px' }}>
            Redeem Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="sp-page-title">Redeem Rewards</h1>

      {/* ── Balance Banner ────────────────────────────── */}
      {balance && (
        <div className="sp-stat-grid" style={{ marginBottom: 24 }}>
          <div className="sp-stat-card">
            <div className="sp-stat-label">Available Rewards</div>
            <div className="sp-stat-value">{balance.balance} <span style={{ fontSize: 14, opacity: 0.4 }}>SAFI</span></div>
          </div>
          <div className="sp-stat-card">
            <div className="sp-stat-label">Business</div>
            <div className="sp-stat-value" style={{ fontSize: 18 }}>{balance.merchantName}</div>
          </div>
          <div className="sp-stat-card">
            <div className="sp-stat-label">Member Tier</div>
            <div style={{ marginTop: 4 }}>
              <span className={`sp-badge sp-badge-${balance.tier}`} style={{ fontSize: 12 }}>{balance.tier?.toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}

      {error && <div className="sp-error">{error}</div>}

      {/* ── Redemption Form or Code ──────────────────── */}
      {!redemption ? (
        <div className="sp-card" style={{ maxWidth: 480 }}>
          <div className="sp-section-label">Start Redemption</div>
          <form onSubmit={handleInitiate}>
            <div className="sp-form-group">
              <label className="sp-label">Business</label>
              <select className="sp-input sp-select" value={selectedMerchant}
                onChange={e => setSelectedMerchant(e.target.value)}>
                {merchants.map(m => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="sp-form-group">
              <label className="sp-label">Reward Amount</label>
              <input className="sp-input" type="number" min="50" step="1"
                placeholder="Minimum 50 SAFI" value={amount} onChange={e => setAmount(e.target.value)} required />
              {amount && parseFloat(amount) > 0 && (
                <div style={{
                  marginTop: 8, padding: '10px 14px',
                  background: 'linear-gradient(135deg, rgba(239,191,74,0.06), rgba(239,191,74,0.12))',
                  borderRadius: 8, fontSize: 14, fontWeight: 600,
                  color: 'var(--navy)',
                }}>
                  Estimated value: {(parseFloat(amount) * 0.10).toFixed(2)} KES
                </div>
              )}
            </div>
            <button type="submit" className="sp-btn sp-btn-gold" style={{ width: '100%', marginTop: 4 }} disabled={loading}>
              {loading ? 'Processing...' : 'Create Redemption Code'}
            </button>
          </form>
        </div>
      ) : (
        <div className="sp-card" style={{ textAlign: 'center', maxWidth: 480, padding: 32 }}>
          <div className="sp-section-label" style={{ marginBottom: 16 }}>Present This Code</div>
          <div className="sp-redeem-code">{redemption.code}</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 16 }}>
            <strong>{redemption.safiAmount} SAFI</strong> → <strong>{redemption.discountAmount} KES</strong> customer value
          </p>
          <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4, fontWeight: 500 }}>
            Expires in {redemption.expiresInMinutes} minutes
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={handleConfirm} className="sp-btn sp-btn-primary" style={{ flex: 1, padding: '14px' }} disabled={loading}>
              {loading ? 'Finalizing redemption...' : 'Confirm Redemption'}
            </button>
            <button onClick={() => setRedemption(null)} className="sp-btn sp-btn-ghost" style={{ flex: 1 }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
