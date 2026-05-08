import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Transactions() {
  const { isMerchant } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        let url;
        if (isMerchant) {
          url = `/merchants/me/transactions?limit=50${filter !== 'all' ? `&type=${filter}` : ''}`;
        } else {
          const profile = await api.get('/customers/me');
          const merchantId = profile.data.enrolledMerchants?.[0]?._id;
          if (!merchantId) { setLoading(false); return; }
          url = `/loyalty/transactions?merchantId=${merchantId}&limit=50${filter !== 'all' ? `&type=${filter}` : ''}`;
        }
        const res = await api.get(url);
        setTransactions(res.data.transactions || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [isMerchant, filter]);

  if (loading) return <div className="sp-loading"><div className="sp-spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="sp-page-title" style={{ marginBottom: 0 }}>Reward Activity</h1>
        <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 8, padding: 3 }}>
          {['all', 'earn', 'redeem'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '7px 14px', fontSize: 12, fontWeight: 600,
              borderRadius: 6, border: 'none', cursor: 'pointer',
              color: filter === f ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: filter === f ? 'white' : 'transparent',
              boxShadow: filter === f ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s',
            }}>
              {f === 'all' ? 'All' : f === 'earn' ? 'Earned' : 'Redeemed'}
            </button>
          ))}
        </div>
      </div>

      <div className="sp-card">
        {transactions.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '40px 0', fontSize: 14 }}>
            No activity found for the selected filter
          </p>
        ) : (
          transactions.map(tx => (
            <div key={tx._id} className="sp-tx-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="sp-tx-icon" style={{
                  background: tx.type === 'earn' ? 'var(--success-bg)' : '#FFF7ED',
                  color: tx.type === 'earn' ? 'var(--success)' : '#EA580C',
                  fontWeight: 700,
                }}>
                  {tx.type === 'earn' ? '↗' : '↙'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {tx.type === 'earn' ? 'Rewards Earned' : 'Rewards Redeemed'}
                    {tx.merchant?.name ? ` — ${tx.merchant.name}` : ''}
                    {tx.customer?.name ? ` — ${tx.customer.name}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {new Date(tx.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                    {tx.fiatAmount ? ` · KES ${tx.fiatAmount.toLocaleString()}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={tx.type === 'earn' ? 'sp-tx-amount-earn' : 'sp-tx-amount-redeem'} style={{ fontSize: 16 }}>
                  {tx.type === 'earn' ? '+' : '−'}{tx.safiAmount}
                  <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 3 }}>SAFI</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                  <span className={`sp-badge ${tx.status === 'confirmed' ? 'sp-badge-earn' : 'sp-badge-pending'}`}>
                    {tx.status}
                  </span>
                  {tx.xrplTxHash && (
                    <a href={`https://testnet.xrpl.org/transactions/${tx.xrplTxHash}`}
                       target="_blank" rel="noreferrer" className="sp-tx-hash">
                      {tx.xrplTxHash.slice(0, 12)}...
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
