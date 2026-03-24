import { useEffect, useState, useRef } from 'react';
import './App.css';
import ToyCard from './component/toyCard';
import CartSidebar from './component/CartSidebar';
import LoginPage from './pages/LoginPage';

const CATEGORIES = ['All', 'Action Figures', 'Vehicles', 'Plush', 'Building Sets', 'Puzzles'];

function App() {
  // ── Auth State ──
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; }
  });
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // ── Shop State ──
  const [toys, setToys] = useState([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [cartItems, setCartItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const [view, setView] = useState('shop'); // 'shop' | 'admin' | 'history'
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownTimeoutRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 1000); // Auto-hide after 1 second
  };

  const handleDropdownEnter = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setIsShopDropdownOpen(true);
  };
// 2 seconds delay before closing the dropdown
  const handleDropdownLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setIsShopDropdownOpen(false);
    }, 2000);
  };


  useEffect(() => {
    fetch('/api/toys')
      .then((res) => res.json())
      .then((data) => setToys(data))
      .catch((err) => console.error('Fetch error:', err));
  }, []);

  useEffect(() => {
    let interval;
    if (currentUser) {
      const fetchUnreadCount = () => {
        const token = sessionStorage.getItem('token');
        if (!token) return;
        fetch('/api/unread-counts', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data && typeof data.unreadCount === 'number') {
            setUnreadCount(data.unreadCount);
          }
        })
        .catch(err => console.error(err));
      };
      fetchUnreadCount();
      interval = setInterval(fetchUnreadCount, 15000);
    } else {
      setUnreadCount(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [currentUser]);

  // ── Cart Persistence & Sync ──
  useEffect(() => {
    if (currentUser) {
      const token = sessionStorage.getItem('token');
      fetch('/api/cart', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.items) {
            setCartItems(data.items.map(item => ({
              toy: item,
              qty: item.qty,
              cartItemId: item.cartItemId
            })));
          }
        })
        .catch(err => console.error('Load cart error:', err));
    } else {
      // Load from local storage for guests
      const guestCart = JSON.parse(localStorage.getItem('guest_cart') || '[]');
      setCartItems(guestCart);
    }
  }, [currentUser]);

  // Save guest cart to local storage
  useEffect(() => {
    if (!currentUser) {
      localStorage.setItem('guest_cart', JSON.stringify(cartItems));
    }
  }, [cartItems, currentUser]);

  // ── Auth Handlers ──
  const handleLoginSuccess = (user) => {
    const token = sessionStorage.getItem('token');
    const guestCart = JSON.parse(localStorage.getItem('guest_cart') || '[]');
    
    if (guestCart.length > 0) {
      // Sync guest cart to server
      const syncPromises = guestCart.map(item => 
        fetch('/api/cart/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ toyId: item.toy.id, qty: item.qty })
        })
      );

      Promise.all(syncPromises).then(() => {
        localStorage.removeItem('guest_cart');
        setCurrentUser(user);
        setIsAuthOpen(false);
      }).catch(err => {
        console.error('Sync error:', err);
        setCurrentUser(user);
        setIsAuthOpen(false);
      });
    } else {
      setCurrentUser(user);
      setIsAuthOpen(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setCurrentUser(null);
    setCartItems([]);
    setCartOpen(false);
    setView('shop');
  };

  // ── Cart Handlers ──
  const handleAddToCart = (toy) => {
    const existing = cartItems.find(i => i.toy.id === toy.id);
    if (existing) {
      handleUpdateQty(toy.id, existing.qty + 1);
      return;
    }

    const newItem = { toy, qty: 1 };

    if (!currentUser) {
      setCartItems(prev => [...prev, newItem]);
      setCartBump(true);
      setTimeout(() => setCartBump(false), 300);
      return;
    }

    const token = sessionStorage.getItem('token');
    fetch('/api/cart/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ toyId: toy.id, qty: 1 })
    })
    .then(res => res.json())
    .then(() => {
      fetch('/api/cart', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        setCartItems(data.items.map(item => ({
          toy: item,
          qty: item.qty,
          cartItemId: item.cartItemId
        })));
      });
      setCartBump(true);
      setTimeout(() => setCartBump(false), 300);
    })
    .catch(err => console.error('Add to cart error:', err));
  };

  const handleUpdateQty = (toyId, newQty) => {
    if (!currentUser) {
      if (newQty <= 0) {
        handleRemove(toyId);
      } else {
        setCartItems(prev => prev.map(i => i.toy.id === toyId ? { ...i, qty: newQty } : i));
      }
      return;
    }

    const item = cartItems.find(i => i.toy.id === toyId);
    if (!item) return;

    const token = sessionStorage.getItem('token');
    if (newQty <= 0) {
      handleRemove(toyId);
    } else {
      fetch(`/api/cart/items/${item.cartItemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ qty: newQty })
      })
      .then(() => {
        setCartItems(prev => prev.map(i => i.toy.id === toyId ? { ...i, qty: newQty } : i));
      })
      .catch(err => console.error('Update qty error:', err));
    }
  };

  const handleRemove = (toyId) => {
    if (!currentUser) {
      setCartItems(prev => prev.filter(i => i.toy.id !== toyId));
      return;
    }

    const item = cartItems.find(i => i.toy.id === toyId);
    if (!item) return;

    const token = sessionStorage.getItem('token');
    fetch(`/api/cart/items/${item.cartItemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(() => {
      setCartItems(prev => prev.filter(i => i.toy.id !== toyId));
    })
    .catch(err => console.error('Remove item error:', err));
  };
  const totalCartCount = cartItems.reduce((sum, item) => sum + item.qty, 0);

  const handleCheckout = () => {
    if (!currentUser) {
      setCartOpen(false);
      setIsAuthOpen(true);
    } else {
      const token = sessionStorage.getItem('token');
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        showToast(`Order #${data.orderId} completed! Total: $${data.total.toFixed(2)}`);
        setCartItems([]);
        setCartOpen(false);
      })
      .catch(err => {
        showToast('Checkout failed: ' + err.message, 'error');
      });
    }
  };

  const filtered = toys.filter((toy) => {
    const matchesCategory = activeCategory === 'All' || toy.category === activeCategory;
    const matchesSearch = toy.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand" onClick={() => setView('shop')} style={{ cursor: 'pointer' }}>
          <span className="brand-icon">🎁</span>
          <span className="brand-gradient">Premium Collectable Collections</span>
        </div>
        <div className="navbar-actions">
          <nav className="navbar-nav">
            <div 
              className={`nav-dropdown${isShopDropdownOpen ? ' open' : ''}`}
              onMouseEnter={handleDropdownEnter}
              onMouseLeave={handleDropdownLeave}
            >
              <button 
                className={`nav-link${view === 'shop' || view === 'contact' ? ' active' : ''}`} 
                onClick={() => setView('shop')}
                style={{ position: 'relative' }}
              >
                Shop <span className="chevron">▾</span>
                {currentUser?.role === 'user' && unreadCount > 0 && <span style={{ position: 'absolute', top: '0', right: '-5px', width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }}></span>}
              </button>
              <div className="dropdown-content">
                <button className="dropdown-item" onClick={() => { setView('shop'); setIsShopDropdownOpen(false); }}>Products</button>
                <button className="dropdown-item" onClick={() => { setView('contact'); setIsShopDropdownOpen(false); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Contact Us
                  {currentUser?.role === 'user' && unreadCount > 0 && <span style={{ background: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px' }}>{unreadCount}</span>}
                </button>
              </div>
            </div>
            {currentUser && currentUser.role !== 'operator' && (
              <button className={`nav-link${view === 'history' ? ' active' : ''}`} onClick={() => setView('history')}>History</button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'operator') && (
              <button className={`nav-link${view === 'admin' ? ' active' : ''}`} onClick={() => setView('admin')}>Admin</button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'operator') && (
              <button className={`nav-link${view === 'inbox' ? ' active' : ''}`} onClick={() => setView('inbox')} style={{ position: 'relative' }}>
                Inbox
                {unreadCount > 0 && <span style={{ position: 'absolute', top: '-5px', right: '-10px', background: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px' }}>{unreadCount}</span>}
              </button>
            )}
          </nav>

          {currentUser ? (
            <div className="navbar-user">
              <span className="user-avatar">{(currentUser.name || currentUser.username || 'U').charAt(0).toUpperCase()}</span>
              <span className="user-name">{currentUser.username || currentUser.name}</span>
              {(currentUser.role === 'admin' || currentUser.role === 'operator') && <span className="admin-badge">{currentUser.role === 'admin' ? 'Admin' : 'Operator'}</span>}
            </div>
          ) : (
            <button className="login-btn" onClick={() => setIsAuthOpen(true)}>Login</button>
          )}

          {/* Cart */}
          <button
            id="cart-toggle-btn"
            className={`cart-btn${cartBump ? ' cart-bump' : ''}`}
            onClick={() => setCartOpen(true)}
            aria-label="Open cart"
          >
            🛒
            {totalCartCount > 0 && <span className="cart-count">{totalCartCount}</span>}
          </button>

          {/* Logout */}
          {currentUser && (
            <button className="logout-btn" onClick={handleLogout} aria-label="Logout">
              Sign Out
            </button>
          )}
        </div>
      </nav>

      {/* Multi-View Content */}
      <main className="content-area">
        {view === 'shop' && (
          <>
            {/* Hero */}
            <section className="hero">
              <div className="hero-eyebrow">✨ Curated Premium Toys</div>
              <h1 className="hero-title">
                Find the Perfect <span className="gradient-text">Toy Collection</span>
              </h1>
              <p className="hero-subtitle">
                Discover handpicked premium toys for every age — from action figures to building sets and beyond.
              </p>
            </section>

            {/* Controls */}
            <div className="controls">
              <div className="search-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  id="search-input"
                  className="search-input"
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="filter-pills">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className={`pill${activeCategory === cat ? ' active' : ''}`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Collection Grid */}
            <section className="collection-section">
              <div className="collection-header">
                <span className="collection-title">Collection</span>
                <span className="collection-count">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="toy-grid">
                {filtered.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🔭</div>
                    <p>No toys found. Try a different search or category.</p>
                  </div>
                ) : (
                  filtered.map((toy) => (
                    <ToyCard key={toy.id} toy={toy} onAddToCart={handleAddToCart} />
                  ))
                )}
              </div>
            </section>
          </>
        )}

        {(view === 'admin') && (currentUser?.role === 'admin' || currentUser?.role === 'operator') && (
          <AdminPanel 
            currentUser={currentUser}
            toys={toys} 
            onToyUpdate={async () => {
              try {
                const res = await fetch('/api/toys');
                const data = await res.json();
                setToys(data);
              } catch (err) {
                console.error('Failed to sync toys:', err);
              }
            }} 
            showToast={showToast}
          />
        )}

        {view === 'history' && currentUser && (
          <PurchaseHistory />
        )}

        {view === 'contact' && (
          <ContactUs currentUser={currentUser} setUnreadCount={setUnreadCount} />
        )}

        {view === 'inbox' && (currentUser?.role === 'admin' || currentUser?.role === 'operator') && (
          <AdminInbox showToast={showToast} setUnreadCount={setUnreadCount} />
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        © 2026 <span>Premium Collections</span> — All rights reserved.
      </footer>

      {/* Cart Sidebar */}
      <CartSidebar
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        onUpdateQty={handleUpdateQty}
        onRemove={handleRemove}
        onCheckout={handleCheckout}
      />

      {/* Auth Modal */}
      {isAuthOpen && (
        <div className="auth-modal-overlay">
          <div className="auth-modal-content">
            <button className="auth-close-btn" onClick={() => setIsAuthOpen(false)}>✕</button>
            <LoginPage onLoginSuccess={handleLoginSuccess} onClose={() => setIsAuthOpen(false)} />
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </>
  );
}

// ── Helper Components ──

function AdminPanel({ currentUser, toys, onToyUpdate, showToast }) {
  const [updatingId, setUpdatingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }
  const [activeTab, setActiveTab] = useState(currentUser?.role === 'operator' ? 'users' : 'inventory');
  const [pendingStockChanges, setPendingStockChanges] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const [editingToy, setEditingToy] = useState(null);
  const hasPending = Object.keys(pendingStockChanges).length > 0;

  const handleStockChange = (toyId, newStatus) => {
    // Check if the new status is different from the original status
    const originalToy = toys.find(t => t.id === toyId);
    if (originalToy.stock_status === newStatus) {
      setPendingStockChanges(prev => {
        const next = { ...prev };
        delete next[toyId];
        return next;
      });
    } else {
      setPendingStockChanges(prev => ({ ...prev, [toyId]: newStatus }));
    }
  };

  const handleBulkSave = async () => {
    setUpdatingId('bulk');
    const token = sessionStorage.getItem('token');
    
    try {
      const results = await Promise.all(Object.entries(pendingStockChanges).map(async ([id, status]) => {
        const res = await fetch(`/api/toys/${id}/stock`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ stock_status: status })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to update toy ${id}`);
        }
        return res.json();
      }));

      console.log('Bulk update results:', results);
      await onToyUpdate(); // Re-fetch all toys from server
      setPendingStockChanges({});
      showToast('Inventory updated successfully!');
    } catch (err) {
      console.error('Bulk update error:', err);
      showToast('Update failed: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancelChanges = () => {
    setPendingStockChanges({});
  };

  const handleDelete = (toy) => {
    setConfirmDelete(toy);
  };

  const proceedDelete = () => {
    if (!confirmDelete) return;
    const token = sessionStorage.getItem('token');
    fetch(`/api/toys/${confirmDelete.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(async res => {
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete toy');
      }
      showToast('Toy deleted successfully');
      onToyUpdate();
      setConfirmDelete(null);
    })
    .catch(err => {
      console.error(err);
      showToast(err.message, 'error');
    });
  };

  const handleSaveToy = async (toyData) => {
    const token = sessionStorage.getItem('token');
    const method = toyData.id ? 'PUT' : 'POST';
    const url = toyData.id ? `/api/toys/${toyData.id}` : '/api/toys';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(toyData)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save toy');

      showToast(`Toy ${toyData.id ? 'updated' : 'added'} successfully`);
      await onToyUpdate();
      setEditingToy(null);
      setIsAdding(false);
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="admin-panel">
      {/* ... existing header ... */}
      <div className="admin-header" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 className="section-title">Admin Management</h2>
          <div className="admin-tabs" style={{ display: 'flex', gap: '10px' }}>
            {currentUser?.role === 'admin' && (
              <button 
                className={`pill${activeTab === 'inventory' ? ' active' : ''}`} 
                onClick={() => setActiveTab('inventory')}
              >
                Inventory
              </button>
            )}
            {currentUser?.role === 'operator' && (
              <button 
                className={`pill${activeTab === 'users' ? ' active' : ''}`} 
                onClick={() => setActiveTab('users')}
              >
                Users
              </button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'operator') && (
              <button 
                className={`pill${activeTab === 'orders' ? ' active' : ''}`} 
                onClick={() => setActiveTab('orders')}
              >
                Purchase Orders
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {hasPending && activeTab === 'inventory' && (
            <>
              <button 
                className="cancel-link" 
                onClick={handleCancelChanges}
                disabled={updatingId === 'bulk'}
                style={{ padding: '0.6rem 1rem' }}
              >
                Cancel
              </button>
              <button 
                className="add-toy-btn" 
                onClick={handleBulkSave}
                disabled={updatingId === 'bulk'}
                style={{ background: 'var(--accent)', minWidth: '130px' }}
              >
                {updatingId === 'bulk' ? 'Saving...' : 'Save Updates'}
              </button>
            </>
          )}
          {activeTab === 'inventory' && currentUser?.role === 'admin' && (
            <button className="add-toy-btn" onClick={() => setIsAdding(true)}>+ Add New Toy</button>
          )}
        </div>
      </div>

      {(isAdding || editingToy) && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <h3>{editingToy ? 'Edit Toy' : 'Add New Toy'}</h3>
            <ToyForm
              toy={editingToy}
              onSave={handleSaveToy}
              onCancel={() => { setEditingToy(null); setIsAdding(false); }}
            />
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal-content">
            <h3>Delete Toy?</h3>
            <p>Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This action cannot be undone.</p>
            <div className="confirm-modal-actions">
              <button className="confirm-modal-btn cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="confirm-modal-btn confirm" onClick={proceedDelete}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' ? (
        <div className="admin-grid">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Toy</th>
                <th>Price</th>
                <th>Category</th>
                <th>Stock Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {toys.map(toy => (
                <tr key={toy.id}>
                  <td>
                    <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>{toy.emoji}</span>
                    {toy.name}
                  </td>
                  <td>${toy.price.toFixed(2)}</td>
                  <td>{toy.category}</td>
                  <td>
                    <select
                      className="stock-select"
                      value={pendingStockChanges[toy.id] || toy.stock_status}
                      onChange={(e) => handleStockChange(toy.id, e.target.value)}
                      disabled={updatingId === 'bulk'}
                      style={pendingStockChanges[toy.id] ? { borderColor: 'var(--accent)', background: 'rgba(109, 40, 217, 0.05)' } : {}}
                    >
                      <option value="available">Available</option>
                      <option value="low">Low Stock</option>
                      <option value="sold_out">Sold Out</option>
                    </select>
                  </td>
                  <td>
                    <button className="edit-btn" onClick={() => setEditingToy(toy)}>Edit</button>
                    <button className="delete-btn" onClick={() => handleDelete(toy)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'users' ? (
        <AdminUsersPanel showToast={showToast} />
      ) : (
        <AdminOrdersPanel showToast={showToast} />
      )}
    </div>
  );
}

function ToyForm({ toy, onSave, onCancel }) {
  const [form, setForm] = useState(toy || {
    name: '',
    price: '', // Start as empty string for better validation
    category: 'Action Figures',
    emoji: '🎁',
    badge: '',
    description: ''
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (form.price === '' || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) {
      newErrors.price = 'Valid price is required';
    }
    if (!form.category) newErrors.category = 'Category is required';
    if (!form.emoji.trim()) newErrors.emoji = 'Emoji is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(prev => {
      const { [name]: removed, ...rest } = prev;
      return rest;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave({ ...form, price: parseFloat(form.price) });
    }
  };

  return (
    <form className="toy-form" onSubmit={handleSubmit}>
      <div className={`form-group ${errors.name ? 'error' : ''}`}>
        <label>Name</label>
        <input name="name" value={form.name} onChange={handleChange} required />
        {errors.name && <span className="error-text">⚠️ {errors.name}</span>}
      </div>
      <div className="form-row">
        <div className={`form-group ${errors.price ? 'error' : ''}`}>
          <label>Price ($)</label>
          <input name="price" type="number" step="0.01" value={form.price} onChange={handleChange} required />
          {errors.price && <span className="error-text">⚠️ {errors.price}</span>}
        </div>
        <div className={`form-group ${errors.category ? 'error' : ''}`}>
          <label>Category</label>
          <select name="category" value={form.category} onChange={handleChange}>
            {['Action Figures', 'Vehicles', 'Plush', 'Building Sets', 'Puzzles'].map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {errors.category && <span className="error-text">⚠️ {errors.category}</span>}
        </div>
      </div>
      <div className="form-row">
        <div className={`form-group ${errors.emoji ? 'error' : ''}`}>
          <label>Emoji Icon</label>
          <input name="emoji" value={form.emoji} onChange={handleChange} required />
          {errors.emoji && <span className="error-text">⚠️ {errors.emoji}</span>}
        </div>
        <div className="form-group">
          <label>Badge (Optional)</label>
          <input name="badge" value={form.badge || ''} onChange={handleChange} placeholder="e.g. Hot, Sale" />
        </div>
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea name="description" value={form.description || ''} onChange={handleChange} rows="3" />
      </div>
      <div className="form-actions">
        <button type="button" className="cancel-link" onClick={onCancel}>Cancel</button>
        <button type="submit" className="save-btn">Save Toy</button>
      </div>
    </form>
  );
}

function PurchaseHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    fetch('/api/orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setOrders([]);
        console.error('History fetch error:', data);
      }
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="loading">Loading history...</div>;

  return (
    <div className="history-page">
      <h2 className="section-title">Your Purchase History</h2>
      {orders.length === 0 ? (
        <div className="empty-history">You haven't made any purchases yet.</div>
      ) : (
        <div className="order-list">
          {orders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <div>
                  <span className="order-id">Order #{order.id}</span>
                  <span className="order-date">{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <span className="order-total">${order.total_amount.toFixed(2)}</span>
                  <span className={`status-badge ${order.status.replace(/\s+/g, '-')}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>
              </div>
              <div className="order-items">
                {order.items.map(item => (
                  <div key={item.id} className="order-item">
                    <span>{item.name} x {item.qty}</span>
                    <span>${(item.price_at_purchase * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactUs({ currentUser, setUnreadCount }) {
  const [messages, setMessages] = useState([]);
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let interval;
    if (currentUser) {
      const fetchMsgs = () => {
        const token = sessionStorage.getItem('token');
        fetch('/api/conversations', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
          setMessages(data.messages || []);
          if (data.unreadCount > 0) {
            fetch('/api/conversations/read', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            }).then(() => { if (setUnreadCount) setUnreadCount(0); });
          }
        });
      };
      
      fetchMsgs();
      interval = setInterval(fetchMsgs, 3000); // Poll every 3 seconds
    }
    return () => { if (interval) clearInterval(interval); };
  }, [currentUser, setUnreadCount]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('token');
    fetch('/api/contact', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ email: currentUser ? null : email, content })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      setStatus('Message sent successfully!');
      setContent('');
      if (currentUser) {
        setMessages(prev => [...prev, { content, sender_role: 'user', created_at: new Date().toISOString() }]);
      }
    })
    .catch(err => setStatus('Error: ' + err.message));
  };

  const handleEmojiClick = (emoji) => {
    setContent(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Mock file upload by just appending the file name to the message
      setContent(prev => prev + ` [Attached File: ${file.name}]`);
    }
  };

  return (
    <div className="contact-page">
      <div className="contact-hero">
        <h1 className="hero-title">HAVE SOME <span className="gradient-text">QUESTIONS?</span></h1>
      </div>
      
      <div className="contact-grid-container">
        <div className="contact-form-side" style={{ height: currentUser ? '600px' : 'auto', gridColumn: '1 / -1', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          {currentUser ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#1e293b' }}>Support Chat</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>We typically reply within a few hours.</p>
              </div>
              
              <div className="chat-window" style={{ flex: 1, padding: '1.5rem', margin: 0, maxHeight: 'none' }}>
                {messages.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
                    <p>No messages yet. Start a conversation!</p>
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const isOwn = m.sender_role === 'user';
                    const msgClass = isOwn ? 'own-message' : 'other-message';
                    const roleClass = m.sender_role === 'user' ? 'user' : 'admin';
                    return (
                    <div key={i} className={`chat-bubble-wrapper ${msgClass} ${roleClass}`}>
                      <div className="bubble-header">
                        <span className="bubble-name">{isOwn ? 'You' : 'Support Agent'}</span>
                        <span className="bubble-time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={`chat-bubble ${msgClass} ${roleClass}`}>
                        <div className="bubble-content">{m.content}</div>
                      </div>
                    </div>
                  )})
                )}
              </div>

              <form className="reply-form" onSubmit={handleSubmit} style={{ borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>
                <div className="reply-input-wrapper" style={{ position: 'relative' }}>
                  <input value={content} onChange={e => setContent(e.target.value)} placeholder="Type a message..." required />
                  <div className="reply-icons">
                    <span className="reply-icon" onClick={() => fileInputRef.current.click()} title="Attach File">📎</span>
                    <span className="reply-icon" onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Emoji">😊</span>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                  {showEmojiPicker && (
                    <div className="emoji-picker" style={{ position: 'absolute', bottom: '100%', right: '0', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem', display: 'flex', gap: '5px', zIndex: 10, marginBottom: '10px' }}>
                      {['😀','😍','🥳','👍','🙏','💡'].map(emoji => (
                        <span key={emoji} style={{ cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => handleEmojiClick(emoji)}>{emoji}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button type="submit" className="send-btn-circle" aria-label="Send">
                  <span>➤</span>
                </button>
              </form>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input type="text" placeholder="First Name" required />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input type="text" placeholder="Last Name" required />
                </div>
              </div>
              <div className="form-group">
                <label>What's your email?</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" required />
              </div>
              <div className="form-group">
                <label>Your questions...</label>
                <textarea value={content} onChange={e => setContent(e.target.value)} rows="5" placeholder="How can we help you?" required />
              </div>
              <button type="submit" className="save-btn full-width">SEND MESSAGE</button>
              {status && <p className="status-msg" style={{ color: status.startsWith('Error') ? '#ef4444' : '#10b981', textAlign: 'center', marginTop: '1rem' }}>{status}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminInbox({ showToast, setUnreadCount }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [currentUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; }
  });

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = () => {
    const token = sessionStorage.getItem('token');
    fetch('/api/admin/conversations', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(setConversations);
  };

  const handleSelect = (conv) => {
    setSelectedConv(conv);
    const token = sessionStorage.getItem('token');
    fetch(`/api/admin/conversations/${conv.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setMessages(data);
      if (conv.unread_count > 0) {
        if (setUnreadCount) setUnreadCount(prev => Math.max(0, prev - conv.unread_count));
        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
      }
    });
  };

  const handleReply = (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('token');
    fetch(`/api/admin/conversations/${selectedConv.id}/reply`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content: reply })
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to send reply');
      setMessages(prev => [...prev, { content: reply, sender_role: currentUser.role === 'admin' ? 'admin' : 'operator', created_at: new Date().toISOString() }]);
      setReply('');
    })
    .catch(err => showToast(err.message, 'error'));
  };

  const handleDeleteMessage = (msgId) => {
    if (!confirm('Delete this message for everyone?')) return;
    const token = sessionStorage.getItem('token');
    fetch(`/api/admin/messages/${msgId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to delete message');
      setMessages(prev => prev.filter(m => m.id !== msgId));
      showToast('Message deleted');
    })
    .catch(err => showToast(err.message, 'error'));
  };

  const handleDeleteConversation = () => {
    if (!confirm('Delete this entire conversation for everyone?')) return;
    const token = sessionStorage.getItem('token');
    fetch(`/api/admin/conversations/${selectedConv.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to delete conversation');
      setSelectedConv(null);
      setMessages([]);
      fetchConversations();
      showToast('Conversation deleted');
    })
    .catch(err => showToast(err.message, 'error'));
  };

  return (
    <div className="inbox-page">
      <h2 className="section-title">Message <span className="gradient-text">Center</span></h2>
      <div className="inbox-container">
        <div className="conv-list">
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e293b' }}>Conversations</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>{conversations.length} active threads</p>
          </div>
          {conversations.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
              No messages yet
            </div>
          ) : (
            conversations.map(c => (
              <div key={c.id} className={`conv-item ${selectedConv?.id === c.id ? 'active' : ''}`} onClick={() => handleSelect(c)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div className="conv-user" style={{ fontWeight: c.unread_count > 0 ? 'bold' : 'normal' }}>
                    {c.user_name || 'Guest'}
                    {c.unread_count > 0 && <span style={{ background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: 'bold', padding: '1px 5px', borderRadius: '10px', marginLeft: '6px' }}>{c.unread_count}</span>}
                  </div>
                  <div className="conv-time">{new Date(c.updated_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
                  {c.user_email || c.guest_email || 'No email provided'}
                </div>
                <div className="conv-last" style={{ fontWeight: c.unread_count > 0 ? 'bold' : 'normal', color: c.unread_count > 0 ? '#1e293b' : '#64748b' }}>{c.last_message || 'No messages'}</div>
              </div>
            ))
          )}
        </div>
        <div className="chat-area">
          {selectedConv ? (
            <>
              <div className="chat-header">
                <div className="chat-header-info">
                  <h3>{selectedConv.user_name || 'Guest'}</h3>
                  <p>{selectedConv.user_email || selectedConv.guest_email || 'Active Conversation'}</p>
                </div>
                <div className="chat-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '800', padding: '4px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#64748b' }}>
                    ID: #{selectedConv.id}
                  </span>
                  <button onClick={handleDeleteConversation} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem' }} title="Delete Conversation">
                    🗑️
                  </button>
                </div>
              </div>
              <div className="chat-window">
                {messages.map((m, i) => {
                  const isOwn = m.sender_role === 'admin' || m.sender_role === 'operator';
                  const msgClass = isOwn ? 'own-message' : 'other-message';
                  const roleClass = m.sender_role;
                  return (
                  <div key={i} className={`chat-bubble-wrapper ${msgClass} ${roleClass}`}>
                    <div className="bubble-header">
                      <span className="bubble-name">
                        {isOwn ? `You (${m.sender_role === 'admin' ? 'Admin' : 'Operator'})` : (selectedConv.user_name || 'Guest')}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="bubble-time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {m.id && (
                          <button onClick={() => handleDeleteMessage(m.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.7 }} title="Delete Message">
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`chat-bubble ${msgClass} ${roleClass}`}>
                      <div className="bubble-content">{m.content}</div>
                    </div>
                  </div>
                )})}
              </div>
              <form className="reply-form" onSubmit={handleReply}>
                <div className="reply-input-wrapper">
                  <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Type a message..." required />
                  <div className="reply-icons">
                    <span className="reply-icon" title="Emoji">😊</span>
                    <span className="reply-icon" title="Attach">📎</span>
                  </div>
                </div>
                <button type="submit" className="send-btn-circle" aria-label="Send">
                  <span>➤</span>
                </button>
              </form>
            </>
          ) : (
            <div className="empty-chat">
              <h3>In-box Empty</h3>
              <p>Select a message from the list on the left to start responding.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminUsersPanel({ showToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    const token = sessionStorage.getItem('token');
    fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
      return data;
    })
    .then(data => {
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers([]);
        showToast('Invalid data received', 'error');
      }
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setUsers([]);
      setLoading(false);
      if (showToast) showToast('Error: ' + err.message, 'error');
    });
  };

  const handleResetPassword = (userId) => {
    const isWarning = confirm("⚠️ WARNING: This will force the user to reset their password. They will NOT be able to access the shop until they set a new password. \n\nAre you sure you want to proceed?");
    if (!isWarning) return;
    
    const token = sessionStorage.getItem('token');
    fetch(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      showToast(data.message || 'Password reset flagged.');
      fetchUsers();
    })
    .catch(err => showToast('Error: ' + err.message, 'error'));
  };

  const handleToggleDisable = (userId, disable) => {
    const action = disable ? 'disable' : 'enable';
    const warningMsg = disable 
      ? "🚫 WARNING: DISABLING this account will immediately block the user from logging in or using the site. \n\nContinue with disabling?"
      : "✅ Re-enable this account?";
      
    if (!confirm(warningMsg)) return;
    
    const token = sessionStorage.getItem('token');
    fetch(`/api/admin/users/${userId}/${action}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      showToast(data.message || `Account ${action}d.`);
      fetchUsers();
    })
    .catch(err => showToast('Error: ' + err.message, 'error'));
  };

  if (loading) return <div>Loading users...</div>;

  return (
    <div className="admin-grid">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Last Login</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td style={{ fontWeight: '600' }}>{u.username}</td>
              <td style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.email}>{u.email}</td>
              <td><span className={`role-badge ${u.role}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>{u.role}</span></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {u.last_login_at 
                  ? new Date(u.last_login_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + 
                    new Date(u.last_login_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) 
                  : 'Never'}
              </td>
              <td>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {u.is_disabled ? (
                    <span style={{ color: '#ff4d4d', fontSize: '0.75rem', fontWeight: '700' }}>🚫 Disabled</span>
                  ) : u.must_reset_password ? (
                    <span style={{ color: '#f39c12', fontSize: '0.75rem', fontWeight: '700' }}>⌛ Pending Reset</span>
                  ) : (
                    <span style={{ color: '#2ecc71', fontSize: '0.75rem', fontWeight: '700' }}>🟢 Active</span>
                  )}
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    className="edit-btn" 
                    onClick={() => handleResetPassword(u.id)}
                    style={{ background: '#f39c12', color: '#fff', border: 'none' }}
                  >
                    Reset Password
                  </button>
                  {u.is_disabled ? (
                    <button 
                      className="edit-btn" 
                      onClick={() => handleToggleDisable(u.id, false)}
                      style={{ background: '#2ecc71', color: '#fff', border: 'none' }}
                    >
                      Enable Account
                    </button>
                  ) : (
                    <button 
                      className="delete-btn" 
                      onClick={() => handleToggleDisable(u.id, true)}
                    >
                      Disable Account
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function AdminOrdersPanel({ showToast }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = () => {
    const token = sessionStorage.getItem('token');
    fetch('/api/admin/orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setOrders(Array.isArray(data) ? data : []);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  const updateStatus = (orderId, newStatus) => {
    const token = sessionStorage.getItem('token');
    fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      showToast(`Order #${orderId} updated to ${newStatus}`);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    })
    .catch(err => showToast(err.message, 'error'));
  };

  if (loading) return <div>Loading orders...</div>;

  return (
    <div className="admin-grid">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Total</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id}>
              <td>#{order.id}</td>
              <td>
                <div style={{ fontWeight: '600' }}>{order.username}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{order.email}</div>
              </td>
              <td>
                <div style={{ fontSize: '0.85rem' }}>
                  {order.items.map(item => `${item.name} (x${item.qty})`).join(', ')}
                </div>
              </td>
              <td style={{ fontWeight: '700' }}>${order.total_amount.toFixed(2)}</td>
              <td>
                <span className={`status-badge ${order.status.replace(/\s+/g, '-')}`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </td>
              <td>
                <select 
                  className="stock-select"
                  value={order.status}
                  onChange={(e) => updateStatus(order.id, e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                >
                  <option value="ordered">Ordered</option>
                  <option value="out for shipping">Out for Shipping</option>
                  <option value="out for delivery">Out for Delivery</option>
                  <option value="completed">Completed</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;