import { useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import RewardPrompt from '../components/RewardPrompt';

/**
 * OrderSuccess — payment confirmation + RewardPrompt trigger.
 *
 * Mirrors SafiSend's PaymentConfirmation.js pattern:
 *   1. Show success confirmation with order details
 *   2. After a delay, trigger the RewardPrompt popup
 *   3. RewardPrompt handles navigation to claim/signup
 */
export default function OrderSuccess() {
  useParams();
  const { state } = useLocation();
  const [showReward, setShowReward] = useState(true);

  const paymentData = state?.paymentData;
  const merchant = state?.merchant;
  const reward = paymentData?.reward;

  if (!paymentData) {
    return (
      <div className="os-page">
        <div className="os-card">
          <h2>Order not found</h2>
          <p>This confirmation link has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="os-page">
      <motion.div
        className="os-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Success animation */}
        <div className="os-check-container">
          <motion.div
            className="os-check-ring"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2, stiffness: 200 }}
          >
            <motion.svg
              className="os-checkmark"
              viewBox="0 0 52 52"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <motion.path
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 27l7.8 7.8L38 17"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              />
            </motion.svg>
          </motion.div>
        </div>

        <h1 className="os-title">Payment Successful</h1>
        <p className="os-subtitle">{merchant?.name}</p>

        {/* Order details */}
        <div className="os-details">
          <div className="os-detail-row">
            <span>Order</span>
            <span className="os-detail-value">#{paymentData.orderNumber}</span>
          </div>
          <div className="os-detail-row">
            <span>Amount Paid</span>
            <span className="os-detail-value">KES {paymentData.total?.toLocaleString()}</span>
          </div>
          <div className="os-detail-row">
            <span>Payment</span>
            <span className="os-detail-value os-detail-status">Confirmed ✓</span>
          </div>
          {paymentData.paidAt && (
            <div className="os-detail-row">
              <span>Time</span>
              <span className="os-detail-value">
                {new Date(paymentData.paidAt).toLocaleTimeString('en-KE', {
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>

        {/* SAFI earned badge */}
        {reward && (
          <motion.div
            className={`os-safi-badge ${reward.autoMinted ? 'os-safi-badge--minted' : ''}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: 'spring' }}
          >
            <span className="os-safi-icon">{reward.autoMinted ? '✅' : '✨'}</span>
            <div>
              <div className="os-safi-amount">+{reward.safiEarned} SAFI earned</div>
              <div className="os-safi-sub">
                {reward.autoMinted
                  ? 'Added to your wallet automatically'
                  : `KES ${reward.kshCashback} cashback waiting for you`}
              </div>
            </div>
          </motion.div>
        )}

        <p className="os-footer-text">
          Thank you for your order! Your food is being prepared.
        </p>
      </motion.div>

      {/* ── RewardPrompt (like GoogleReviewPrompt, appears after delay) ── */}
      {showReward && reward && (
        <RewardPrompt
          reward={reward}
          onDismiss={() => setShowReward(false)}
          onSignUp={() => setShowReward(false)}
          autoShowDelay={2000}
        />
      )}
    </div>
  );
}
