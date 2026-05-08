import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import api from '../api/client';
import '../styles/merchant-qr.css';

export default function MerchantQR() {
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/merchants/me');
        setMerchant(res.data.merchant);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const menuUrl = merchant
    ? `${window.location.origin}/m/${merchant.slug}`
    : '';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = menuUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [menuUrl]);

  const handleDownload = useCallback(() => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);

    const canvas = document.createElement('canvas');
    const size = 1024;
    canvas.width = size;
    canvas.height = size + 140;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => {
      const padding = 80;
      ctx.drawImage(img, padding, padding, size - padding * 2, size - padding * 2);

      ctx.fillStyle = '#0F1524';
      ctx.font = 'bold 36px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(merchant?.name || 'SafiPoints', size / 2, size + 50);

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '24px Montserrat, sans-serif';
      ctx.fillText('Scan to view menu & order', size / 2, size + 90);

      const link = document.createElement('a');
      link.download = `${merchant?.slug || 'safipoints'}-qr-code.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [merchant]);

  if (loading) {
    return <div className="sp-loading"><div className="sp-spinner" /></div>;
  }

  if (!merchant) {
    return (
      <div className="mq-error">
        <p>Failed to load merchant info. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="mq-page sp-animate-stagger">
      <h1 className="sp-page-title">QR Code & Ordering Link</h1>
      <p className="mq-subtitle">
        Customers scan this code to view your menu, place orders, and earn SAFI cashback.
      </p>

      <div className="mq-layout">
        {/* QR Card */}
        <motion.div
          className="mq-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mq-qr-frame" ref={qrRef}>
            <div className="mq-qr-corner mq-qr-corner--tl" />
            <div className="mq-qr-corner mq-qr-corner--tr" />
            <div className="mq-qr-corner mq-qr-corner--bl" />
            <div className="mq-qr-corner mq-qr-corner--br" />
            <QRCodeSVG
              value={menuUrl}
              size={220}
              level="H"
              bgColor="transparent"
              fgColor="#0F1524"
              includeMargin={false}
            />
          </div>

          <div className="mq-card-info">
            <h2 className="mq-card-name">{merchant.name}</h2>
            <p className="mq-card-slug">/m/{merchant.slug}</p>
          </div>

          <div className="mq-actions">
            <button className="mq-btn mq-btn--primary" onClick={handleDownload}>
              <span className="mq-btn-icon">↓</span>
              Download QR Code
            </button>
            <button
              className={`mq-btn mq-btn--secondary ${copied ? 'mq-btn--copied' : ''}`}
              onClick={handleCopy}
            >
              <span className="mq-btn-icon">{copied ? '✓' : '⎘'}</span>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </motion.div>

        {/* Instructions */}
        <motion.div
          className="mq-info-panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="mq-info-section">
            <h3 className="mq-info-title">How it works</h3>
            <div className="mq-steps">
              {[
                { num: '1', icon: null, title: 'Customer scans QR code', desc: 'Place the QR code on tables, at the counter, or on printed materials.' },
                { num: '2', icon: null, title: 'Browse menu & order', desc: 'They see your full menu, add items to cart, and place their order.' },
                { num: '3', icon: null, title: 'Pay at checkout', desc: 'Customer pays for their order through the payment flow.' },
                { num: '4', icon: '✦', title: 'Earn SAFI cashback', desc: 'They automatically earn SAFI rewards on every purchase.' },
              ].map((step, i) => (
                <div key={i} className="mq-step">
                  <div className="mq-step-num">{step.num}</div>
                  <div className="mq-step-body">
                    <div className="mq-step-title">
                      {step.icon && <span className="mq-step-icon">{step.icon}</span>}
                      {step.title}
                    </div>
                    <p className="mq-step-desc">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mq-info-section">
            <h3 className="mq-info-title">Where to place your QR code</h3>
            <div className="mq-tips">
              {['Table tents / table stickers', 'Front counter display', 'Printed receipts or flyers', 'Social media posts', 'Website or Google Maps listing'].map((tip, i) => (
                <div key={i} className="mq-tip">
                  <span className="mq-tip-dot" />
                  {tip}
                </div>
              ))}
            </div>
          </div>

          <div className="mq-link-preview">
            <span className="mq-link-label">Direct link</span>
            <code className="mq-link-url">{menuUrl}</code>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
