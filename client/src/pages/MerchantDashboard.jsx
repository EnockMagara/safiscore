import { useState, useEffect } from 'react';
import api from '../api/client';

export default function MerchantDashboard() {
  const [data, setData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, custRes, txRes] = await Promise.all([
          api.get('/merchants/me'),
          api.get('/merchants/me/customers'),
          api.get('/merchants/me/transactions?limit=10'),
        ]);
        setData(dashRes.data);
        setCustomers(custRes.data.customers);
        setTransactions(txRes.data.transactions);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="sp-loading"><div className="sp-spinner" /></div>;

  const { merchant, stats } = data || {};

  return (
    <div className="sp-animate-stagger">
      <h1 className="sp-page-title">Business Performance</h1>

      {/* ── Stats ────────────────────────────────────── */}
      <div className="sp-stat-grid" style={{ marginBottom: 24 }}>
        {[
          { value: stats?.customers || 0, label: 'Active Customers', color: 'var(--navy)' },
          { value: stats?.earned?.total?.toLocaleString() || 0, label: 'Rewards Issued', color: 'var(--success)' },
          { value: stats?.redeemed?.total?.toLocaleString() || 0, label: 'Rewards Redeemed', color: 'var(--danger)' },
          { value: `${(merchant?.earnRate * 100) || 10}%`, label: 'Reward Rate', color: 'var(--gold)' },
        ].map((s, i) => (
          <div key={i} className="sp-stat-card">
            <div className="sp-stat-label">{s.label}</div>
            <div className="sp-stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Merchant Info ────────────────────────────── */}
      <div className="sp-card" style={{ marginBottom: 20 }}>
        <div className="sp-section-label">Business Profile</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14 }}>
          <div>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Business Name</span>
            <div style={{ fontWeight: 600 }}>{merchant?.name}</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Business ID</span>
            <div style={{ fontFamily: '"SF Mono", monospace', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{merchant?.id}</div>
          </div>
          <div style={{ gridColumn: '1/3' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Verification Account</span>
            <div>
              <a href={`https://testnet.xrpl.org/accounts/${merchant?.xrplAddress}`}
                 target="_blank" rel="noreferrer" className="sp-tx-hash" style={{ fontSize: 12 }}>
                {merchant?.xrplAddress}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* ── Customers ──────────────────────────────── */}
        <div className="sp-card">
          <div className="sp-section-label">Customer Portfolio ({customers.length})</div>
          {customers.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
              No customers added yet
            </p>
          ) : (
            customers.map(c => (
              <div key={c._id} className="sp-tx-row">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name || c.phone}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{c.phone}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                    {c.cachedBalance} <span style={{ fontSize: 11, opacity: 0.5 }}>SAFI</span>
                  </div>
                  <span className={`sp-badge sp-badge-${c.tier}`}>{c.tier}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Transactions ───────────────────────────── */}
        <div className="sp-card">
          <div className="sp-section-label">Recent Reward Activity</div>
          {transactions.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
              No activity yet
            </p>
          ) : (
            transactions.map(tx => (
              <div key={tx._id} className="sp-tx-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`sp-badge ${tx.type === 'earn' ? 'sp-badge-earn' : 'sp-badge-redeem'}`}>
                    {tx.type === 'earn' ? 'Earned' : 'Redeemed'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {tx.customer?.name || tx.customer?.phone}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={tx.type === 'earn' ? 'sp-tx-amount-earn' : 'sp-tx-amount-redeem'} style={{ fontSize: 14 }}>
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
    </div>
  );
}
