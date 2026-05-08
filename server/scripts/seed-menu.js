/**
 * Seed demo menu items for an existing merchant.
 *
 * Usage:  node scripts/seed-menu.js <merchant-slug>
 * If no slug is provided, seeds all merchants.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Merchant = require('../models/Merchant');
const MenuItem = require('../models/MenuItem');

const DEMO_MENUS = {
  uae: [
    { name: 'Machboos (Lamb)',        price: 55,  category: 'Mains',    emoji: '🍖', description: 'Slow-cooked spiced rice with tender lamb' },
    { name: 'Mixed Grill Platter',    price: 95,  category: 'Mains',    emoji: '🥩', description: 'Assorted grilled meats with saffron rice' },
    { name: 'Shawarma Wrap',          price: 28,  category: 'Mains',    emoji: '🌯', description: 'Classic chicken shawarma with garlic sauce' },
    { name: 'Grilled Hammour',        price: 75,  category: 'Mains',    emoji: '🐟', description: 'Whole grilled hammour with herb butter' },
    { name: 'Kabsa (Chicken)',        price: 45,  category: 'Mains',    emoji: '🍗', description: 'Fragrant spiced rice with roasted chicken' },
    { name: 'Hummus & Pita',          price: 22,  category: 'Sides',    emoji: '🫓', description: 'Creamy hummus with warm pita bread' },
    { name: 'Fattoush Salad',         price: 25,  category: 'Sides',    emoji: '🥗', description: 'Fresh vegetables with crispy bread & pomegranate' },
    { name: 'Mutabbaq (Spinach)',      price: 30,  category: 'Sides',    emoji: '🥬', description: 'Crispy stuffed pastry with spiced spinach' },
    { name: 'Luqaimat',               price: 20,  category: 'Desserts', emoji: '🍯', description: 'Crispy Emirati dumplings drizzled with date syrup' },
    { name: 'Umm Ali',                price: 28,  category: 'Desserts', emoji: '🍮', description: 'Traditional UAE bread pudding with nuts & cream' },
    { name: 'Karak Chai',             price: 8,   category: 'Drinks',   emoji: '🍵', description: 'Rich spiced tea brewed with evaporated milk' },
    { name: 'Fresh Lemon Mint',       price: 18,  category: 'Drinks',   emoji: '🍋', description: 'Freshly squeezed lemon with crushed mint' },
    { name: 'Jallab Juice',           price: 20,  category: 'Drinks',   emoji: '🍇', description: 'Sweet grape juice with rose water & raisins' },
  ],
};

async function seedMenu(slug) {
  await connectDB();

  const filter = slug ? { slug } : {};
  const merchants = await Merchant.find(filter);

  if (!merchants.length) {
    console.log(slug ? `No merchant found with slug "${slug}"` : 'No merchants in database. Register one first.');
    process.exit(1);
  }

  for (const merchant of merchants) {
    const existingCount = await MenuItem.countDocuments({ merchant: merchant._id });
    if (existingCount > 0) {
      console.log(`  ⏭  ${merchant.name} already has ${existingCount} menu items — skipping`);
      continue;
    }

    const items = DEMO_MENUS.uae.map((item, i) => ({
      ...item,
      merchant: merchant._id,
      sortOrder: i,
    }));

    await MenuItem.insertMany(items);
    console.log(`  ✓  Seeded ${items.length} items for "${merchant.name}" (${merchant.slug})`);
  }

  console.log('\nDone. Customers can now visit: /m/<slug>');
  process.exit(0);
}

const slug = process.argv[2];
seedMenu(slug).catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
