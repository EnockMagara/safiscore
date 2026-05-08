const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const Merchant = require('../models/Merchant');
const Customer = require('../models/Customer');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const MenuItem = require('../models/MenuItem');

const router = express.Router();

const merchantAuth = [authenticateToken, requireRole('merchant')];

// ─── Get Own Merchant Profile ─────────────────────────────────
router.get('/me', authenticateToken, requireRole('merchant'), async (req, res, next) => {
  try {
    const merchant = await Merchant.findById(req.user.id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    const customerCount = await Customer.countDocuments({ enrolledMerchants: merchant._id });
    const txStats = await LoyaltyTransaction.aggregate([
      { $match: { merchant: merchant._id, status: 'confirmed' } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$safiAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {};
    txStats.forEach(s => { stats[s._id] = { total: s.total, count: s.count }; });

    res.json({
      merchant: {
        id: merchant._id,
        name: merchant.name,
        slug: merchant.slug,
        email: merchant.email,
        xrplAddress: merchant.xrplAddress,
        earnRate: merchant.earnRate,
        minRedemption: merchant.minRedemption,
        redemptionRate: merchant.redemptionRate,
      },
      stats: {
        customers: customerCount,
        earned: stats.earn || { total: 0, count: 0 },
        redeemed: stats.redeem || { total: 0, count: 0 },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Update Merchant Settings ─────────────────────────────────
router.put('/me', authenticateToken, requireRole('merchant'), async (req, res, next) => {
  try {
    const { earnRate, minRedemption, redemptionRate, name, phone } = req.body;
    const updates = {};
    if (earnRate !== undefined) updates.earnRate = earnRate;
    if (minRedemption !== undefined) updates.minRedemption = minRedemption;
    if (redemptionRate !== undefined) updates.redemptionRate = redemptionRate;
    if (name) updates.name = name;
    if (phone) updates.phone = phone;

    const merchant = await Merchant.findByIdAndUpdate(req.user.id, updates, { new: true });
    res.json({ message: 'Settings updated', merchant });
  } catch (err) {
    next(err);
  }
});

// ─── List Enrolled Customers ──────────────────────────────────
router.get('/me/customers', authenticateToken, requireRole('merchant'), async (req, res, next) => {
  try {
    const customers = await Customer.find({ enrolledMerchants: req.user.id })
      .select('name phone xrplAddress cachedBalance tier totalEarned totalRedeemed createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ count: customers.length, customers });
  } catch (err) {
    next(err);
  }
});

// ─── Merchant Transaction History ─────────────────────────────
router.get('/me/transactions', authenticateToken, requireRole('merchant'), async (req, res, next) => {
  try {
    const { type, limit = 50 } = req.query;
    const filter = { merchant: req.user.id };
    if (type) filter.type = type;

    const transactions = await LoyaltyTransaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('customer', 'name phone')
      .lean();

    res.json({ count: transactions.length, transactions });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════
// ─── Menu Item CRUD ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// List all menu items for the authenticated merchant
router.get('/me/menu', ...merchantAuth, async (req, res, next) => {
  try {
    const items = await MenuItem.find({ merchant: req.user.id })
      .sort({ category: 1, sortOrder: 1, name: 1 })
      .lean();

    const categories = {};
    for (const item of items) {
      const cat = item.category || 'Main';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    }

    res.json({ count: items.length, items, categories });
  } catch (err) {
    next(err);
  }
});

// Create a new menu item
router.post('/me/menu', ...merchantAuth, async (req, res, next) => {
  try {
    const { name, description, price, category, image, emoji, isAvailable, sortOrder } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'name and price are required' });
    }

    const item = await MenuItem.create({
      merchant: req.user.id,
      name: name.trim(),
      description: description?.trim(),
      price: Number(price),
      category: category?.trim() || 'Main',
      image,
      emoji: emoji || '🍽️',
      isAvailable: isAvailable !== false,
      sortOrder: sortOrder || 0,
    });

    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

// Update a menu item (only if owned by this merchant)
router.put('/me/menu/:itemId', ...merchantAuth, async (req, res, next) => {
  try {
    const item = await MenuItem.findOne({ _id: req.params.itemId, merchant: req.user.id });
    if (!item) return res.status(404).json({ error: 'Menu item not found' });

    const allowed = ['name', 'description', 'price', 'category', 'image', 'emoji', 'isAvailable', 'sortOrder'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) item[key] = req.body[key];
    }
    await item.save();

    res.json({ item });
  } catch (err) {
    next(err);
  }
});

// Delete a menu item
router.delete('/me/menu/:itemId', ...merchantAuth, async (req, res, next) => {
  try {
    const result = await MenuItem.findOneAndDelete({ _id: req.params.itemId, merchant: req.user.id });
    if (!result) return res.status(404).json({ error: 'Menu item not found' });

    res.json({ message: 'Menu item deleted', id: req.params.itemId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
