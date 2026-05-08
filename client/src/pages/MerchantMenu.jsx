import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/client';
import '../styles/merchant-menu.css';

const EMOJI_OPTIONS = ['🍽️','🍔','🍕','🌮','🥗','🍝','🍛','🍜','🥘','🥩','🍗','🐟','🦐','🍟','🧆','🥙','🍞','🧁','🍰','🍩','🥤','☕','🍵','🥛','🧃','🍺','🍷','🥂','🥃','🧊'];

const EMPTY_FORM = { name: '', description: '', price: '', category: '', emoji: '🍽️', isAvailable: true };

export default function MerchantMenu() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('__all__');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deletingId, setDeletingId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const loadMenu = useCallback(async () => {
    try {
      const res = await api.get('/merchants/me/menu');
      setItems(res.data.items);
      setCategories(res.data.categories);
    } catch (err) {
      console.error('Failed to load menu:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  const categoryNames = useMemo(() => Object.keys(categories).sort(), [categories]);

  const filteredItems = useMemo(() => {
    if (activeCategory === '__all__') return items;
    return items.filter(i => (i.category || 'Main') === activeCategory);
  }, [items, activeCategory]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item._id);
    setForm({
      name: item.name,
      description: item.description || '',
      price: String(item.price),
      category: item.category || '',
      emoji: item.emoji || '🍽️',
      isAvailable: item.isAvailable !== false,
    });
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowEmojiPicker(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.name.trim()) { setFormError('Item name is required'); return; }
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0) {
      setFormError('Enter a valid price'); return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        category: form.category.trim() || 'Main',
        emoji: form.emoji,
        isAvailable: form.isAvailable,
      };

      if (editingId) {
        await api.put(`/merchants/me/menu/${editingId}`, payload);
      } else {
        await api.post('/merchants/me/menu', payload);
      }

      closeForm();
      await loadMenu();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId) => {
    setDeletingId(itemId);
    try {
      await api.delete(`/merchants/me/menu/${itemId}`);
      await loadMenu();
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      await api.put(`/merchants/me/menu/${item._id}`, { isAvailable: !item.isAvailable });
      await loadMenu();
    } catch (err) {
      console.error('Failed to toggle:', err);
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  if (loading) {
    return (
      <div className="sp-loading"><div className="sp-spinner" /></div>
    );
  }

  return (
    <div className="mm-page sp-animate-stagger">
      {/* Header */}
      <div className="mm-header">
        <div>
          <h1 className="sp-page-title">Menu Management</h1>
          <p className="mm-subtitle">{items.length} item{items.length !== 1 ? 's' : ''} across {categoryNames.length} {categoryNames.length === 1 ? 'category' : 'categories'}</p>
        </div>
        <button className="mm-add-btn" onClick={openCreate}>
          <span className="mm-add-btn-icon">+</span>
          Add Item
        </button>
      </div>

      {/* Category Filter */}
      {categoryNames.length > 0 && (
        <div className="mm-cat-bar">
          <button
            className={`mm-cat-pill ${activeCategory === '__all__' ? 'mm-cat-pill--active' : ''}`}
            onClick={() => setActiveCategory('__all__')}
          >
            All ({items.length})
          </button>
          {categoryNames.map(cat => (
            <button
              key={cat}
              className={`mm-cat-pill ${activeCategory === cat ? 'mm-cat-pill--active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat} ({categories[cat]?.length || 0})
            </button>
          ))}
        </div>
      )}

      {/* Menu Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="mm-empty">
          <div className="mm-empty-icon">🍽️</div>
          <h3>No menu items yet</h3>
          <p>Add your first dish to start serving customers</p>
          <button className="mm-add-btn" onClick={openCreate}>
            <span className="mm-add-btn-icon">+</span>
            Add Your First Item
          </button>
        </div>
      ) : (
        <div className="mm-grid">
          {filteredItems.map((item, idx) => (
            <motion.div
              key={item._id}
              className={`mm-card ${!item.isAvailable ? 'mm-card--unavailable' : ''}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03, duration: 0.3 }}
            >
              <div className="mm-card-top">
                <span className="mm-card-emoji">{item.emoji}</span>
                <span className={`mm-avail-badge ${item.isAvailable ? 'mm-avail-badge--on' : 'mm-avail-badge--off'}`}>
                  {item.isAvailable ? 'Available' : 'Unavailable'}
                </span>
              </div>

              <h3 className="mm-card-name">{item.name}</h3>
              {item.description && (
                <p className="mm-card-desc">{item.description}</p>
              )}

              <div className="mm-card-meta">
                <span className="mm-card-price">KES {item.price.toLocaleString()}</span>
                <span className="mm-card-cat">{item.category || 'Main'}</span>
              </div>

              <div className="mm-card-actions">
                <button
                  className="mm-action-btn mm-action-btn--toggle"
                  onClick={() => handleToggleAvailability(item)}
                  title={item.isAvailable ? 'Mark unavailable' : 'Mark available'}
                >
                  {item.isAvailable ? '◉' : '◯'}
                </button>
                <button
                  className="mm-action-btn mm-action-btn--edit"
                  onClick={() => openEdit(item)}
                  title="Edit item"
                >
                  ✎
                </button>
                <button
                  className="mm-action-btn mm-action-btn--delete"
                  onClick={() => handleDelete(item._id)}
                  disabled={deletingId === item._id}
                  title="Delete item"
                >
                  {deletingId === item._id ? '...' : '✕'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Add / Edit Modal ────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              className="mm-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeForm}
            />
            <div className="mm-modal-host">
              <motion.div
                className="mm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mm-modal-title"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mm-modal-header">
                  <h2 className="mm-modal-title" id="mm-modal-title">
                    {editingId ? 'Edit Menu Item' : 'Add Menu Item'}
                  </h2>
                  <button type="button" className="mm-modal-close" onClick={closeForm}>✕</button>
                </div>

                <form className="mm-form mm-form--modal" onSubmit={handleSave}>
                  <div className="mm-modal-body">
                {/* Emoji Picker */}
                <div className="mm-form-emoji-section">
                  <button
                    type="button"
                    className="mm-emoji-trigger"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    <span className="mm-emoji-trigger-val">{form.emoji}</span>
                    <span className="mm-emoji-trigger-label">Tap to change</span>
                  </button>
                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div
                        className="mm-emoji-grid"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {EMOJI_OPTIONS.map(e => (
                          <button
                            key={e}
                            type="button"
                            className={`mm-emoji-opt ${form.emoji === e ? 'mm-emoji-opt--active' : ''}`}
                            onClick={() => { updateField('emoji', e); setShowEmojiPicker(false); }}
                          >
                            {e}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Name */}
                <div className="mm-field">
                  <label className="mm-label">Item Name *</label>
                  <input
                    className="mm-input"
                    type="text"
                    placeholder="e.g. Nyama Choma"
                    value={form.name}
                    onChange={e => updateField('name', e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div className="mm-field">
                  <label className="mm-label">Description</label>
                  <textarea
                    className="mm-input mm-textarea"
                    placeholder="Brief description of the dish"
                    value={form.description}
                    onChange={e => updateField('description', e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Price + Category row */}
                <div className="mm-field-row">
                  <div className="mm-field" style={{ flex: 1 }}>
                    <label className="mm-label">Price (KES) *</label>
                    <input
                      className="mm-input"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="500"
                      value={form.price}
                      onChange={e => updateField('price', e.target.value)}
                    />
                  </div>
                  <div className="mm-field" style={{ flex: 1 }}>
                    <label className="mm-label">Category</label>
                    <input
                      className="mm-input"
                      type="text"
                      placeholder="e.g. Main, Drinks, Desserts"
                      value={form.category}
                      onChange={e => updateField('category', e.target.value)}
                      list="mm-category-suggestions"
                    />
                    <datalist id="mm-category-suggestions">
                      {categoryNames.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                </div>

                {/* Availability toggle */}
                <div className="mm-field mm-toggle-field">
                  <label className="mm-label">Available for ordering</label>
                  <button
                    type="button"
                    className={`mm-toggle ${form.isAvailable ? 'mm-toggle--on' : ''}`}
                    onClick={() => updateField('isAvailable', !form.isAvailable)}
                    role="switch"
                    aria-checked={form.isAvailable}
                  >
                    <span className="mm-toggle-knob" />
                  </button>
                </div>

                {formError && <div className="mm-form-error">{formError}</div>}
                  </div>

                  <div className="mm-modal-footer">
                    <div className="mm-form-actions">
                      <button type="button" className="mm-btn-secondary" onClick={closeForm}>Cancel</button>
                      <button type="submit" className="mm-btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : editingId ? 'Update Item' : 'Add Item'}
                      </button>
                    </div>
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
