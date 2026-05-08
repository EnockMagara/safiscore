import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api/client';

export default function CustomerWallet() {
  const [profile, setProfile] = useState(null);
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const profileRes = await api.get('/customers/me');
        setProfile(profileRes.data);

        const bals = await Promise.all(
          (profileRes.data.enrolledMerchants || []).map(async (m) => {
            try {
              const res = await api.get(`/customers/me/balance?merchantId=${m._id}`);
              return res.data;
            } catch { return { merchantName: m.name, balance: 0, issuer: m.xrplAddress }; }
          })
        );
        setBalances(bals);

        if (profileRes.data.enrolledMerchants?.length > 0) {
          const txRes = await api.get(`/loyalty/transactions?merchantId=${profileRes.data.enrolledMerchants[0]._id}`);
          setTransactions(txRes.data.transactions || []);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="sp-loading"><div className="sp-spinner" /></div>;

  const totalBalance = balances.reduce((sum, b) => sum + (b.balance || 0), 0);

  return (
    <div className="sp-animate-stagger">
      {/* ── Wallet Card ──────────────────────────────── */}
      <div className="sp-wallet-card">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="sp-wallet-label">Total Rewards Balance</div>
          <div className="sp-wallet-balance">
            {totalBalance.toLocaleString()}
            <span style={{ fontSize: 20, opacity: 0.5, marginLeft: 8, fontWeight: 600 }}>SAFI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <span className={`sp-badge sp-badge-${profile?.tier}`} style={{ fontSize: 10 }}>
              {profile?.tier?.toUpperCase()}
            </span>
            <span style={{ fontSize: 13, opacity: 0.4 }}>
              {profile?.totalEarned?.toLocaleString()} earned · {profile?.totalRedeemed?.toLocaleString()} redeemed
            </span>
          </div>
          <div className="sp-wallet-address">{profile?.xrplAddress}</div>
        </div>
      </div>

      {/* ── Quick Actions + QR ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="sp-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="sp-section-label" style={{ marginBottom: 16 }}>Quick Actions</div>
          <Link to="/redeem" className="sp-btn sp-btn-gold" style={{ width: '100%', marginBottom: 10 }}>
            Redeem Rewards
          </Link>
          <Link to="/credit" className="sp-btn sp-btn-primary" style={{ width: '100%', marginBottom: 10 }}>
            SafiScore ›
          </Link>
          <Link to="/transactions" className="sp-btn sp-btn-ghost" style={{ width: '100%' }}>
            View Activity
          </Link>
          <a href={`https://testnet.xrpl.org/accounts/${profile?.xrplAddress}`}
             target="_blank" rel="noreferrer"
             style={{ display: 'block', marginTop: 16, fontSize: 12, color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>
            View verification record →
          </a>
        </div>

        <div className="sp-card" style={{ textAlign: 'center' }}>
          <div className="sp-section-label" style={{ marginBottom: 16 }}>Member QR</div>
          <QRCodeSVG value={profile?.xrplAddress || ''} size={120} bgColor="transparent" fgColor="#0F1524" />
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12 }}>
            Share with participating businesses to receive rewards
          </p>
        </div>
      </div>

      {/* ── Balances per Merchant ────────────────────── */}
      {balances.length > 0 && (
        <div className="sp-card" style={{ marginBottom: 20 }}>
          <div className="sp-section-label">Rewards by Business</div>
          {balances.map((b, i) => (
            <div key={i} className="sp-tx-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{b.merchantName}</div>
                <a href={`https://testnet.xrpl.org/accounts/${b.issuer}`}
                   target="_blank" rel="noreferrer" className="sp-tx-hash">
                  {b.issuer}
                </a>
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--navy)', fontVariantNumeric: 'tabular-nums' }}>
                {b.balance} <span style={{ fontSize: 12, opacity: 0.5, fontWeight: 500 }}>SAFI</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Recent Activity ──────────────────────────── */}
      <div className="sp-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="sp-section-label" style={{ marginBottom: 0 }}>Recent Activity</div>
          <Link to="/transactions" style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>
            See All →
          </Link>
        </div>
        {transactions.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
            No activity yet. Complete a qualifying purchase to begin earning rewards.
          </p>
        ) : (
          transactions.slice(0, 5).map(tx => (
            <div key={tx._id} className="sp-tx-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="sp-tx-icon" style={{ background: tx.type === 'earn' ? 'var(--success-bg)' : '#FFF7ED' }}>
                  {tx.type === 'earn' ? '↗' : '↙'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {tx.type === 'earn' ? 'Rewards Earned' : 'Rewards Redeemed'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {tx.merchant?.name} · {new Date(tx.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={tx.type === 'earn' ? 'sp-tx-amount-earn' : 'sp-tx-amount-redeem'} style={{ fontSize: 15 }}>
                  {tx.type === 'earn' ? '+' : '−'}{tx.safiAmount}
                </div>
                {tx.xrplTxHash && (
                  <a href={`https://testnet.xrpl.org/transactions/${tx.xrplTxHash}`}
                     target="_blank" rel="noreferrer" className="sp-tx-hash">
                    {tx.xrplTxHash.slice(0, 10)}...
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
