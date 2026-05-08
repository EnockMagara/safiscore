import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  RiSparklingFill,
  RiCoinLine,
  RiStoreLine,
  RiTimeLine,
  RiLockLine,
  RiCheckboxCircleLine,
  RiExternalLinkLine,
} from 'react-icons/ri';

/**
 * RewardPrompt — adaptive "You earned SAFI!" popup.
 *
 * Three modes based on reward.autoMinted:
 *   1. autoMinted=true  → Points are already in wallet. Celebrate + show balance.
 *   2. autoMinted=false  → New/unclaimed customer. Two-step claim flow.
 *
 * Props:
 *   reward         — { safiEarned, kshCashback, merchantName, pendingId, autoMinted, xrplTxHash, newBalance }
 *   onDismiss      — called when user taps dismiss
 *   onSignUp       — called when user taps claim CTA (only for pending flow)
 *   autoShowDelay  — ms before popup appears (default 1500)
 */
export default function RewardPrompt({ reward, onDismiss, onSignUp, autoShowDelay = 1500 }) {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  const isAutoMinted = reward?.autoMinted === true;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), autoShowDelay);
    return () => clearTimeout(t);
  }, [autoShowDelay]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss?.(), 300);
  };

  const handleClaim = () => {
    setVisible(false);
    if (reward?.pendingId) {
      navigate(`/claim/${reward.pendingId}`);
    } else {
      navigate('/register');
    }
    onSignUp?.();
  };

  if (!reward) return null;

  const pendingBenefits = [
    {
      icon: <RiCoinLine size={18} />,
      title: 'Yours to keep',
      desc:  'Stored on the blockchain — no one can take it',
    },
    {
      icon: <RiStoreLine size={18} />,
      title: 'Use anywhere',
      desc:  'Redeem at any enrolled restaurant',
    },
    {
      icon: <RiTimeLine size={18} />,
      title: '6 months to claim',
      desc:  'After that your cashback expires',
    },
  ];

  const mintedBenefits = [
    {
      icon: <RiCheckboxCircleLine size={18} />,
      title: 'Added to your wallet',
      desc:  'Points are live on XRPL — ready to spend',
    },
    {
      icon: <RiStoreLine size={18} />,
      title: 'Use at checkout',
      desc:  'Apply SAFI as payment on your next order',
    },
    {
      icon: <RiCoinLine size={18} />,
      title: reward.newBalance ? `${reward.newBalance} SAFI total` : 'Balance updated',
      desc:  'Your wallet balance has been updated',
    },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            className="rp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
          />

          {/* Card */}
          <motion.div
            className="rp-card"
            initial={{ opacity: 0, y: 80, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.94 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            {/* Close */}
            <button className="rp-close" onClick={handleDismiss} aria-label="Close">
              &#215;
            </button>

            <AnimatePresence mode="wait">
              {/* ═══ AUTO-MINTED: Points already in wallet ═══ */}
              {isAutoMinted ? (
                <motion.div
                  key="auto-minted"
                  className="rp-body"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="rp-header rp-header--success">
                    <span className="rp-header-icon rp-header-icon--success">
                      <RiCheckboxCircleLine size={38} />
                    </span>
                    <h3 className="rp-header-title">Cashback added!</h3>
                    <p className="rp-header-sub">Automatically added to your wallet</p>
                  </div>

                  <div className="rp-amount-card rp-amount-card--success">
                    <span className="rp-amount-safi">+{reward.safiEarned} SAFI</span>
                    <span className="rp-amount-ksh">≈ KES {reward.kshCashback}</span>
                    <span className="rp-amount-label">added to your balance</span>
                  </div>

                  <div className="rp-benefits">
                    {mintedBenefits.map(b => (
                      <div className="rp-benefit" key={b.title}>
                        <div className="rp-benefit-icon rp-benefit-icon--success">{b.icon}</div>
                        <div className="rp-benefit-text">
                          <strong>{b.title}</strong>
                          <p>{b.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {reward.xrplTxHash && (
                    <a
                      className="rp-tx-link"
                      href={`https://testnet.xrpl.org/transactions/${reward.xrplTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <RiExternalLinkLine size={14} />
                      View on XRPL Ledger
                    </a>
                  )}

                  <button className="rp-cta-primary rp-cta-primary--success" onClick={handleDismiss}>
                    Done
                  </button>
                </motion.div>
              ) : (
                /* ═══ PENDING: Single-step claim ═══ */
                <motion.div
                  key="pending"
                  className="rp-body"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="rp-header">
                    <span className="rp-header-icon">
                      <RiSparklingFill size={38} />
                    </span>
                    <h3 className="rp-header-title">You earned cashback!</h3>
                    <p className="rp-header-sub">at {reward.merchantName}</p>
                  </div>

                  <div className="rp-amount-card">
                    <span className="rp-amount-safi">{reward.safiEarned} SAFI</span>
                    <span className="rp-amount-ksh">≈ KES {reward.kshCashback}</span>
                    <span className="rp-amount-label">cashback earned</span>
                  </div>

                  <div className="rp-benefits">
                    {pendingBenefits.map(b => (
                      <div className="rp-benefit" key={b.title}>
                        <div className="rp-benefit-icon">{b.icon}</div>
                        <div className="rp-benefit-text">
                          <strong>{b.title}</strong>
                          <p>{b.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button className="rp-cta-primary" onClick={handleClaim}>
                    Claim KES {reward.kshCashback}
                  </button>
                  <button className="rp-cta-dismiss" onClick={handleDismiss}>
                    Maybe later
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="rp-footer">
              <RiLockLine size={12} />
              <span>Secured on XRPL</span>
              <span className="rp-footer-dot" />
              <span>SafiPoints</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
