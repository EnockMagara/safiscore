const express = require('express');
const Merchant = require('../models/Merchant');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const PendingPoints = require('../models/PendingPoints');
const Customer = require('../models/Customer');
const LoyaltyService = require('../services/LoyaltyService');
const SafiSendBridge = require('../services/SafiSendBridge');
const TokenService = require('../services/TokenService');

const router = express.Router();

/**
 * Public API — no auth required.
 * These endpoints power the customer-facing ordering experience:
 *   QR scan → menu → cart → pay → earn reward
 */

// ─── GET /api/public/merchant/:slug ─────────────────────────
// Returns merchant info + full menu, grouped by category.
router.get('/merchant/:slug', async (req, res, next) => {
  try {
    const merchant = await Merchant.findOne({
      slug: req.params.slug,
      isActive: true,
    }).select('name slug phone earnRate');

    if (!merchant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const items = await MenuItem.find({
      merchant: merchant._id,
      isAvailable: true,
    }).sort({ category: 1, sortOrder: 1, name: 1 });

    const categories = {};
    for (const item of items) {
      const cat = item.category || 'Main';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    }

    res.json({
      merchant: {
        id: merchant._id,
        name: merchant.name,
        slug: merchant.slug,
        earnRate: merchant.earnRate,
        safiPerKsh: merchant.earnRate,
      },
      menu: categories,
      itemCount: items.length,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/public/order ─────────────────────────────────
// Place an order (from the cart).
router.post('/order', async (req, res, next) => {
  try {
    const { merchantSlug, items, customerPhone, customerName } = req.body;
    if (!merchantSlug || !items?.length || !customerPhone) {
      return res.status(400).json({ error: 'merchantSlug, items[], and customerPhone are required' });
    }

    const merchant = await Merchant.findOne({ slug: merchantSlug, isActive: true });
    if (!merchant) return res.status(404).json({ error: 'Restaurant not found' });

    const menuItems = await MenuItem.find({
      _id: { $in: items.map(i => i.id) },
      merchant: merchant._id,
      isAvailable: true,
    });

    const itemMap = {};
    for (const mi of menuItems) { itemMap[mi._id.toString()] = mi; }

    const orderItems = [];
    let subtotal = 0;
    for (const cartItem of items) {
      const mi = itemMap[cartItem.id];
      if (!mi) continue;
      const qty = Math.max(1, Math.floor(cartItem.quantity || 1));
      orderItems.push({
        menuItem: mi._id,
        name: mi.name,
        price: mi.price,
        quantity: qty,
      });
      subtotal += mi.price * qty;
    }

    if (!orderItems.length) {
      return res.status(400).json({ error: 'No valid menu items in order' });
    }

    const order = await Order.create({
      merchant: merchant._id,
      customerPhone,
      customerName: customerName || 'Guest',
      items: orderItems,
      subtotal,
      total: subtotal,
    });

    res.status(201).json({
      orderId: order._id,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
      status: order.status,
      items: orderItems.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/public/order/:id/pay ─────────────────────────
// Simulate payment → triggers SAFI earn (PendingPoints).
// Optionally applies SAFI discount (burns tokens on-chain first).
router.post('/order/:id/pay', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('merchant');
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'paid') return res.status(409).json({ error: 'Order already paid' });

    const merchant = order.merchant;
    let safiDiscountResult = null;

    // If customer is applying SAFI points as partial payment, burn them first
    if (req.body.safiDiscount && req.body.safiDiscount.pointsToUse > 0) {
      const { pointsToUse } = req.body.safiDiscount;
      safiDiscountResult = await SafiSendBridge.applyCheckoutDiscount({
        customerPhone: order.customerPhone,
        merchantId: merchant._id,
        pointsToUse,
        orderId: order._id.toString(),
      });
      // Reduce order total by discount amount
      order.total = Math.max(0, order.total - safiDiscountResult.discountAmount);
    }

    // Simulate payment success
    order.status = 'paid';
    order.paymentMethod = req.body.method || 'simulated';
    order.paidAt = new Date();

    const tier = 'bronze';
    const safiAmount = LoyaltyService.calculateEarn(order.total, merchant.earnRate, tier);
    const earnRate = merchant.earnRate;

    // Check if customer already has an XRPL wallet with this merchant's trust line
    const existingCustomer = await Customer.findOne({ phone: order.customerPhone }).select('+xrplSeedEnc');
    const isEnrolled = existingCustomer?.xrplAddress && existingCustomer?.trustLineSet
      && existingCustomer.enrolledMerchants?.map(String).includes(String(merchant._id));

    let pending = null;
    let autoMinted = false;
    let mintResult = null;

    if (isEnrolled) {
      // ── Fast path: customer has wallet → mint directly on XRPL ──
      try {
        const fullMerchant = await Merchant.findById(merchant._id).select('+xrplSeedEnc');
        mintResult = await TokenService.issueTokens({
          merchant: fullMerchant,
          customer: existingCustomer,
          amount: safiAmount,
          fiatAmount: order.total,
          metadata: { source: 'auto-earn', orderId: order._id.toString() },
        });
        autoMinted = true;
        order.safiEarned = safiAmount;
      } catch (err) {
        // If auto-mint fails, fall back to pending flow
        console.error('[AUTO-MINT] Failed, falling back to pending:', err.message);
        autoMinted = false;
      }
    }

    if (!autoMinted) {
      // ── Standard path: create PendingPoints + send claim SMS ──
      try {
        pending = await PendingPoints.create({
          phone: order.customerPhone,
          merchant: merchant._id,
          safiAmount,
          fiatAmount: order.total,
          earnRate,
          orderId: order._id.toString(),
        });
        order.safiEarned = safiAmount;
        order.pendingPointsId = pending._id;

        await SafiSendBridge.sendClaimSMS({
          phone: order.customerPhone,
          safiAmount,
          merchantName: merchant.name,
          pendingId: pending._id,
        });
      } catch (err) {
        if (err.code === 11000) {
          pending = await PendingPoints.findOne({ orderId: order._id.toString(), merchant: merchant._id });
          order.safiEarned = pending?.safiAmount || safiAmount;
        } else throw err;
      }
    }

    await order.save();

    res.json({
      paid: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
      paidAt: order.paidAt,
      safiDiscount: safiDiscountResult ? {
        pointsBurned: safiDiscountResult.pointsBurned,
        discountAmount: safiDiscountResult.discountAmount,
        xrplTxHash: safiDiscountResult.xrplTxHash,
      } : null,
      reward: {
        safiEarned: safiAmount,
        kshCashback: (safiAmount * earnRate).toFixed(2),
        earnRate,
        merchantName: merchant.name,
        autoMinted,
        xrplTxHash: mintResult?.xrplTxHash || null,
        newBalance: mintResult?.newBalance || null,
        pendingId: pending?._id || null,
        claimWindowDays: 180,
        expiryDays: 365,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/public/safi-status ─────────────────────────────
// Check if a phone number has SAFI balance with a merchant (no auth).
router.get('/safi-status', async (req, res, next) => {
  try {
    const { phone, merchantId } = req.query;
    if (!phone || !merchantId) {
      return res.status(400).json({ error: 'phone and merchantId are required' });
    }
    const status = await SafiSendBridge.getCustomerStatus(phone, merchantId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/public/calculate-discount ────────────────────
// Preview SAFI discount amount for checkout (no auth).
router.post('/calculate-discount', async (req, res, next) => {
  try {
    const { customerPhone, merchantId, pointsToRedeem, orderAmount } = req.body;
    if (!customerPhone || !merchantId || !orderAmount) {
      return res.status(400).json({ error: 'customerPhone, merchantId, and orderAmount are required' });
    }
    const result = await SafiSendBridge.calculateDiscount({
      customerPhone, merchantId, pointsToRedeem, orderAmount,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/public/order/:id ──────────────────────────────
// Get order status (polling after payment).
router.get('/order/:id', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('merchant', 'name slug');
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      currency: order.currency,
      merchantName: order.merchant?.name,
      items: order.items,
      safiEarned: order.safiEarned,
      paidAt: order.paidAt,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
