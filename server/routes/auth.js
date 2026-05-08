const express = require('express');
const { normalizePhone } = require('../utils/phone');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const Merchant = require('../models/Merchant');
const Customer = require('../models/Customer');
const WalletService = require('../services/WalletService');

const router = express.Router();

// ─── Merchant Registration ────────────────────────────────────
router.post('/merchant/register', async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const hashedPassword = await bcrypt.hash(password, 12);

    console.log('[AUTH] Creating XRPL issuer wallet for merchant...');
    const wallet = await WalletService.createWallet();

    const merchant = await Merchant.create({
      name,
      slug,
      email,
      password: hashedPassword,
      phone,
      xrplAddress: wallet.address,
      xrplSeedEnc: wallet.seedEnc,
    });

    const token = jwt.sign(
      { id: merchant._id, role: 'merchant', xrplAddress: merchant.xrplAddress },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn },
    );

    res.status(201).json({
      message: 'Merchant registered successfully',
      token,
      merchant: {
        id: merchant._id,
        name: merchant.name,
        slug: merchant.slug,
        email: merchant.email,
        xrplAddress: merchant.xrplAddress,
        earnRate: merchant.earnRate,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Merchant Login ───────────────────────────────────────────
router.post('/merchant/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const merchant = await Merchant.findOne({ email }).select('+password');
    if (!merchant || !(await bcrypt.compare(password, merchant.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: merchant._id, role: 'merchant', xrplAddress: merchant.xrplAddress },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn },
    );

    res.json({
      token,
      merchant: {
        id: merchant._id,
        name: merchant.name,
        slug: merchant.slug,
        email: merchant.email,
        xrplAddress: merchant.xrplAddress,
        earnRate: merchant.earnRate,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Customer Registration ────────────────────────────────────
router.post('/customer/register', async (req, res, next) => {
  try {
    const { name, phone, email, merchantId } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'phone is required' });
    }

    const phoneNorm = normalizePhone(phone);
    const phoneOr = [];
    if (phoneNorm) phoneOr.push({ phone: phoneNorm });
    if (phone?.trim()) phoneOr.push({ phone: phone.trim() });
    const existing = phoneOr.length ? await Customer.findOne({ $or: phoneOr }) : null;
    if (existing) {
      return res.status(409).json({ error: 'Customer with this phone already exists' });
    }

    // Need a merchant to set up trust line against their issuer
    const merchant = await Merchant.findById(merchantId);
    if (!merchant || !merchant.xrplAddress) {
      return res.status(400).json({ error: 'Valid merchantId with XRPL wallet required' });
    }

    console.log('[AUTH] Creating XRPL wallet for customer + trust line...');
    const walletData = await WalletService.createCustomerWallet(merchant.xrplAddress);

    const customer = await Customer.create({
      name,
      phone: phoneNorm || phone.trim(),
      email,
      xrplAddress: walletData.address,
      xrplSeedEnc: walletData.seedEnc,
      trustLineSet: walletData.trustLineSet,
      enrolledMerchants: [merchant._id],
    });

    const token = jwt.sign(
      { id: customer._id, role: 'customer', xrplAddress: customer.xrplAddress },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn },
    );

    res.status(201).json({
      message: 'Customer registered — XRPL wallet created',
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        xrplAddress: customer.xrplAddress,
        trustLineSet: walletData.trustLineSet,
        trustTxHash: walletData.trustTxHash,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Customer Login (simple phone lookup for MVP) ─────────────
router.post('/customer/login', async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const phoneNorm = normalizePhone(phone);
    const phoneOr = [];
    if (phoneNorm) phoneOr.push({ phone: phoneNorm });
    if (phone?.trim()) phoneOr.push({ phone: phone.trim() });
    const customer = phoneOr.length ? await Customer.findOne({ $or: phoneOr }) : null;
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const token = jwt.sign(
      { id: customer._id, role: 'customer', xrplAddress: customer.xrplAddress },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn },
    );

    res.json({
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        xrplAddress: customer.xrplAddress,
        cachedBalance: customer.cachedBalance,
        tier: customer.tier,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
