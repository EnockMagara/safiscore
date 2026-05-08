import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/client';

export default function MenuPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [merchant, setMerchant] = useState(null);
  const [menu, setMenu] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);

  const [cart, setCart] = useState({});
  const [showCart, setShowCart] = useState(false);
  const [justAdded, setJustAdded] = useState(null);

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [placing, setPlacing] = useState(false);
  const [formError, setFormError] = useState('');
  const [safiStatus, setSafiStatus] = useState(null);
  const [checkingSafi, setCheckingSafi] = useState(false);

  // Check SAFI status when phone changes (debounced)
  useEffect(() => {
    const trimmed = phone.replace(/\s/g, '');
    if (trimmed.length < 10 || !merchant) {
      setSafiStatus(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingSafi(true);
      try {
        const res = await api.get('/public/safi-status', {
          params: { phone: trimmed, merchantId: merchant.id },
        });
        setSafiStatus(res.data);
      } catch {
        setSafiStatus(null);
      } finally {
        setCheckingSafi(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [phone, merchant]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/public/merchant/${slug}`);
        setMerchant(res.data.merchant);
        setMenu(res.data.menu);
        const cats = Object.keys(res.data.menu);
        if (cats.length) setActiveCategory(cats[0]);
      } catch (err) {
        setError(err.response?.data?.error || 'Restaurant not found');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const addToCart = useCallback((item) => {
    setCart(prev => ({
      ...prev,
      [item._id]: { ...item, quantity: (prev[item._id]?.quantity || 0) + 1 },
    }));
    setJustAdded(item._id);
    setTimeout(() => setJustAdded(null), 600);
  }, []);

  const updateQty = useCallback((id, delta) => {
    setCart(prev => {
      const next = { ...prev };
      const newQty = (next[id]?.quantity || 0) + delta;
      if (newQty <= 0) { delete next[id]; } else { next[id] = { ...next[id], quantity: newQty }; }
      return next;
    });
  }, []);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartCount = useMemo(() => cartItems.reduce((s, i) => s + i.quantity, 0), [cartItems]);
  const cartTotal = useMemo(() => cartItems.reduce((s, i) => s + i.price * i.quantity, 0), [cartItems]);
  const safiPreview = merchant ? Math.round(cartTotal * merchant.earnRate * 100) / 100 : 0;
  const kshCashback = merchant ? (safiPreview * merchant.earnRate).toFixed(0) : 0;

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!phone.trim()) { setFormError('Please enter your phone number to receive your SAFI cashback.'); return; }
    if (!cartItems.length) return;
    setPlacing(true);
    try {
      const res = await api.post('/public/order', {
        merchantSlug: slug,
        items: cartItems.map(i => ({ id: i._id, quantity: i.quantity })),
        customerPhone: phone,
        customerName: name || 'Guest',
      });
      navigate(`/pay/${res.data.orderId}`, {
        state: { order: res.data, merchant, safiPreview, safiStatus, customerPhone: phone },
      });
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="mp-loading">
        <div className="mp-skeleton-logo" />
        <div className="mp-skeleton-text" />
        <div className="mp-skeleton-text mp-skeleton-text--short" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mp-error-page">
        <div className="mp-error-content">
          <div className="mp-error-icon">🍽️</div>
          <h2>Restaurant Not Found</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const categories = Object.keys(menu);

  return (
    <div className="mp-page">

      {/* ── Hero Header ─────────────────────────────── */}
      <header className="mp-hero">
        <div className="mp-hero-overlay" />
        <div className="mp-hero-inner">
          <div className="mp-brand-pill">
            <span className="mp-brand-dot" />
            SafiPoints
          </div>
          <h1 className="mp-hero-name">{merchant.name}</h1>
          <p className="mp-hero-tagline">Fine dining, effortless rewards</p>
        </div>

        {/* SAFI earn chip — always visible in header */}
        <div className="mp-earn-chip">
          <span className="mp-earn-chip-icon">✦</span>
          <span>Earn <strong>KES {Math.round(1000 * merchant.earnRate)}</strong> cashback per KES 1,000 spent</span>
        </div>
      </header>

      {/* ── Category Nav ────────────────────────────── */}
      <nav className="mp-cat-nav">
        <div className="mp-cat-nav-inner">
          {categories.map(cat => (
            <button
              key={cat}
              className={`mp-cat-pill ${activeCategory === cat ? 'mp-cat-pill--active' : ''}`}
              onClick={() => {
                setActiveCategory(cat);
                document.getElementById(`cat-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Menu ────────────────────────────────────── */}
      <main className="mp-menu">
        {categories.map(cat => (
          <section key={cat} id={`cat-${cat}`} className="mp-category">
            <div className="mp-category-heading">
              <span className="mp-category-line" />
              <h2 className="mp-category-title">{cat}</h2>
              <span className="mp-category-line" />
            </div>

            <div className="mp-items">
              {menu[cat].map((item, idx) => {
                const inCart = cart[item._id]?.quantity || 0;
                const isJustAdded = justAdded === item._id;
                return (
                  <motion.div
                    key={item._id}
                    className={`mp-item ${inCart > 0 ? 'mp-item--in-cart' : ''}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.35 }}
                  >
                    {/* Left: content */}
                    <div className="mp-item-body">
                      <div className="mp-item-header">
                        <h3 className="mp-item-name">{item.name}</h3>
                        <span className="mp-item-price">KES {item.price.toLocaleString()}</span>
                      </div>
                      {item.description && (
                        <p className="mp-item-desc">{item.description}</p>
                      )}
                    </div>

                    {/* Right: emoji + CTA */}
                    <div className="mp-item-right">
                      <div className="mp-item-emoji-wrap">
                        <span className="mp-item-emoji">{item.emoji}</span>
                      </div>

                      {inCart > 0 ? (
                        <motion.div
                          className="mp-qty"
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                        >
                          <button
                            className="mp-qty-btn mp-qty-btn--minus"
                            onClick={() => updateQty(item._id, -1)}
                            aria-label="Remove one"
                          >
                            −
                          </button>
                          <span className="mp-qty-num">{inCart}</span>
                          <button
                            className="mp-qty-btn mp-qty-btn--plus"
                            onClick={() => updateQty(item._id, 1)}
                            aria-label="Add one"
                          >
                            +
                          </button>
                        </motion.div>
                      ) : (
                        <motion.button
                          className={`mp-add-btn ${isJustAdded ? 'mp-add-btn--added' : ''}`}
                          onClick={() => addToCart(item)}
                          whileTap={{ scale: 0.88 }}
                          aria-label={`Add ${item.name} to cart`}
                        >
                          {isJustAdded ? '✓' : '+'}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        ))}

        <div className="mp-menu-footer">
          <span className="mp-menu-footer-dot">✦</span>
          <span>End of menu</span>
          <span className="mp-menu-footer-dot">✦</span>
        </div>
      </main>

      {/* ── Sticky Cart Bar ─────────────────────────── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            className="mp-cart-bar"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          >
            <button className="mp-cart-bar-btn" onClick={() => setShowCart(true)}>
              <div className="mp-cart-bar-left">
                <span className="mp-cart-bar-badge">{cartCount}</span>
                <span className="mp-cart-bar-label">Review Order</span>
              </div>
              <div className="mp-cart-bar-right">
                <span className="mp-cart-bar-total">KES {cartTotal.toLocaleString()}</span>
                <span className="mp-cart-bar-arrow">›</span>
              </div>
            </button>
            {safiPreview > 0 && (
              <div className="mp-cart-bar-reward">
                <span className="mp-cart-bar-reward-dot">✦</span>
                Earn <strong>{safiPreview} SAFI</strong> — KES {kshCashback} cashback on this order
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cart Sheet ──────────────────────────────── */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div
              className="mp-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
            />
            <div className="mp-cart-sheet-host">
              <motion.div
                className="mp-cart-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mp-sheet-title"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Sheet Handle */}
                <div className="mp-sheet-handle-bar">
                  <div className="mp-sheet-handle" />
                </div>

                {/* Sheet Header */}
                <div className="mp-sheet-header">
                  <div className="mp-sheet-header-text">
                    <h2 className="mp-sheet-title" id="mp-sheet-title">Your Order</h2>
                    <p className="mp-sheet-subtitle">{merchant.name}</p>
                  </div>
                  <button type="button" className="mp-sheet-close" onClick={() => setShowCart(false)}>✕</button>
                </div>

                <form className="mp-sheet-form mp-sheet-form--stacked" onSubmit={handlePlaceOrder}>
                  <div className="mp-sheet-scroll">
                    {/* Items */}
                    <div className="mp-sheet-items">
                      {cartItems.map((item, idx) => (
                        <motion.div
                          key={item._id}
                          className="mp-sheet-item"
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                        >
                          <span className="mp-sheet-item-emoji">{item.emoji}</span>
                          <div className="mp-sheet-item-info">
                            <div className="mp-sheet-item-name">{item.name}</div>
                            <div className="mp-sheet-item-price">KES {(item.price * item.quantity).toLocaleString()}</div>
                          </div>
                          <div className="mp-sheet-qty">
                            <button type="button" className="mp-sheet-qty-btn" onClick={() => updateQty(item._id, -1)}>−</button>
                            <span className="mp-sheet-qty-num">{item.quantity}</span>
                            <button type="button" className="mp-sheet-qty-btn mp-sheet-qty-btn--add" onClick={() => updateQty(item._id, 1)}>+</button>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="mp-sheet-totals">
                      <div className="mp-sheet-total-row">
                        <span>Subtotal ({cartCount} {cartCount === 1 ? 'item' : 'items'})</span>
                        <span className="mp-sheet-total-amount">KES {cartTotal.toLocaleString()}</span>
                      </div>
                      {safiPreview > 0 && (
                        <div className="mp-sheet-safi-row">
                          <span className="mp-sheet-safi-label">
                            <span className="mp-sheet-safi-dot">✦</span>
                            SAFI cashback you&apos;ll earn
                          </span>
                          <span className="mp-sheet-safi-val">KES {kshCashback}</span>
                        </div>
                      )}
                    </div>

                    <p className="mp-sheet-form-hint">
                      Enter your phone to receive SAFI cashback after payment
                    </p>

                    <div className="mp-sheet-field">
                      <div className="mp-sheet-field-icon" aria-hidden>📱</div>
                      <input
                        type="tel"
                        placeholder="+254 712 345 678"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="mp-sheet-input"
                        autoComplete="tel"
                        required
                      />
                    </div>

                    {/* SAFI balance indicator */}
                    {checkingSafi && (
                      <div className="mp-sheet-safi-status mp-sheet-safi-status--loading">
                        <span className="mp-sheet-safi-dot">✦</span> Checking SAFI balance…
                      </div>
                    )}
                    {!checkingSafi && safiStatus?.enrolled && safiStatus.canRedeem && (
                      <div className="mp-sheet-safi-status mp-sheet-safi-status--found">
                        <span className="mp-sheet-safi-dot">✦</span>
                        <strong>{safiStatus.balance} SAFI</strong> available — use as payment on the next screen!
                      </div>
                    )}
                    {!checkingSafi && safiStatus && !safiStatus.enrolled && safiStatus.pendingSafi > 0 && (
                      <div className="mp-sheet-safi-status mp-sheet-safi-status--pending">
                        <span className="mp-sheet-safi-dot">✦</span>
                        {safiStatus.pendingSafi} SAFI pending — <a href="/claim">claim them first</a> to use at checkout
                      </div>
                    )}
                    <div className="mp-sheet-field">
                      <div className="mp-sheet-field-icon" aria-hidden>👤</div>
                      <input
                        type="text"
                        placeholder="Your name (optional)"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="mp-sheet-input"
                        autoComplete="name"
                      />
                    </div>

                    {formError && (
                      <div className="mp-sheet-error">{formError}</div>
                    )}
                  </div>

                  <div className="mp-sheet-footer">
                    <button
                      type="submit"
                      className="mp-sheet-cta"
                      disabled={placing || !phone.trim()}
                    >
                      {placing ? (
                        <span className="mp-sheet-cta-loading">
                          <span className="mp-sheet-cta-spinner" />
                          Placing order...
                        </span>
                      ) : (
                        <>
                          <span className="mp-sheet-cta-label">Proceed to Payment</span>
                          <span className="mp-sheet-cta-total">KES {cartTotal.toLocaleString()}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
