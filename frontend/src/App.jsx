import { useEffect, useState, useRef } from 'react';
import './App.css';
import ToyCard from './component/toyCard';
import CartSidebar from './component/CartSidebar';
import LoginPage from './pages/LoginPage';

const CATEGORIES = ['All', 'Action Figures', 'Vehicles', 'Plush', 'Building Sets', 'Puzzles'];

function App() {
  // ── Auth State ──
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
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
  const dropdownTimeoutRef = useRef(null);

  const handleDropdownEnter = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setIsShopDropdownOpen(true);
  };

  const handleDropdownLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setIsShopDropdownOpen(false);
    }, 3000);
  };


  useEffect(() => {
    fetch('/api/toys')
      .then((res) => res.json())
      .then((data) => setToys(data))
      .catch((err) => console.error('Fetch error:', err));
  }, []);

  // ── Cart Persistence ──
  useEffect(() => {
    if (currentUser) {
      const token = localStorage.getItem('token');
      fetch('/api/cart', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.items) {
            // Map backend items to the expected frontend format
            setCartItems(data.items.map(item => ({
              toy: item,
              qty: item.qty,
              cartItemId: item.cartItemId
            })));
          }
        })
        .catch(err => console.error('Load cart error:', err));
    } else {
      setCartItems([]);
    }
  }, [currentUser]);

  // ── Auth Handlers ──
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setIsAuthOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setCartItems([]);
    setCartOpen(false);
    setView('shop');
  };

  // ── Cart Handlers ──
  const handleAddToCart = (toy) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }

    const token = localStorage.getItem('token');
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
      // Refresh cart from backend to get the latest state (and cartItemId)
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
    const item = cartItems.find(i => i.toy.id === toyId);
    if (!item) return;

    const token = localStorage.getItem('token');
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
    const item = cartItems.find(i => i.toy.id === toyId);
    if (!item) return;

    const token = localStorage.getItem('token');
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
      const token = localStorage.getItem('token');
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        alert(`Order #${data.orderId} completed! Total: $${data.total.toFixed(2)}`);
        setCartItems([]);
        setCartOpen(false);
      })
      .catch(err => {
        alert('Checkout failed: ' + err.message);
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
        <div className="navbar-brand">
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
              >
                Shop <span className="chevron">▾</span>
              </button>
              <div className="dropdown-content">
                <button className="dropdown-item" onClick={() => { setView('shop'); setIsShopDropdownOpen(false); }}>Products</button>
                <button className="dropdown-item" onClick={() => { setView('contact'); setIsShopDropdownOpen(false); }}>Contact Us</button>
              </div>
            </div>
            {currentUser && (
              <button className={`nav-link${view === 'history' ? ' active' : ''}`} onClick={() => setView('history')}>History</button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'operator') && (
              <button className={`nav-link${view === 'admin' ? ' active' : ''}`} onClick={() => setView('admin')}>Admin</button>
            )}
            {(currentUser?.role === 'admin' || currentUser?.role === 'operator') && (
              <button className={`nav-link${view === 'inbox' ? ' active' : ''}`} onClick={() => setView('inbox')}>Inbox</button>
            )}
          </nav>

          {currentUser ? (
            <div className="navbar-user">
              <span className="user-avatar">{currentUser.name.charAt(0).toUpperCase()}</span>
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
          <AdminPanel toys={toys} onToyUpdate={() => {
            // Re-fetch toys after update
            fetch('/api/toys').then(res => res.json()).then(data => setToys(data));
          }} />
        )}

        {view === 'history' && currentUser && (
          <PurchaseHistory />
        )}

        {view === 'contact' && (
          <ContactUs currentUser={currentUser} />
        )}

        {view === 'inbox' && (currentUser?.role === 'admin' || currentUser?.role === 'operator') && (
          <AdminInbox />
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
    </>
  );
}

// ── Helper Components ──

function AdminPanel({ toys, onToyUpdate }) {
  const [updatingId, setUpdatingId] = useState(null);
  const [editingToy, setEditingToy] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'users'

  const handleStockChange = (toyId, newStatus) => {
    setUpdatingId(toyId);
    const token = localStorage.getItem('token');
    fetch(`/api/toys/${toyId}/stock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ stock_status: newStatus })
    })
    .then(res => res.json())
    .then(() => {
      onToyUpdate();
      setUpdatingId(null);
    })
    .catch(err => {
      console.error(err);
      setUpdatingId(null);
    });
  };

  const handleDelete = (toyId) => {
    if (!confirm('Are you sure you want to delete this toy?')) return;
    const token = localStorage.getItem('token');
    fetch(`/api/toys/${toyId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(() => onToyUpdate())
    .catch(err => console.error(err));
  };

  const handleSaveToy = (toyData) => {
    const token = localStorage.getItem('token');
    const method = toyData.id ? 'PUT' : 'POST';
    const url = toyData.id ? `/api/toys/${toyData.id}` : '/api/toys';

    fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(toyData)
    })
    .then(res => res.json())
    .then(() => {
      onToyUpdate();
      setEditingToy(null);
      setIsAdding(false);
    })
    .catch(err => console.error(err));
  };

  return (
    <div className="admin-panel">
      <div className="admin-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '20px' }}>
        <h2 className="section-title">Admin Management</h2>
        <div className="admin-tabs" style={{ display: 'flex', gap: '10px' }}>
          <button 
            className={`pill${activeTab === 'inventory' ? ' active' : ''}`} 
            onClick={() => setActiveTab('inventory')}
          >
            Inventory
          </button>
          <button 
            className={`pill${activeTab === 'users' ? ' active' : ''}`} 
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
        </div>
        {activeTab === 'inventory' && (
          <button className="add-toy-btn" onClick={() => setIsAdding(true)}>+ Add New Toy</button>
        )}
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

      {activeTab === 'inventory' ? (
        <div className="admin-grid">
          <table className="admin-table">
            {/* ... existing table head ... */}
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
                      value={toy.stock_status}
                      onChange={(e) => handleStockChange(toy.id, e.target.value)}
                      disabled={updatingId === toy.id}
                    >
                      <option value="available">Available</option>
                      <option value="low">Low Stock</option>
                      <option value="sold_out">Sold Out</option>
                    </select>
                  </td>
                  <td>
                    <button className="edit-btn" onClick={() => setEditingToy(toy)}>Edit</button>
                    <button className="delete-btn" onClick={() => handleDelete(toy.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <AdminUsersPanel />
      )}
    </div>
  );
}

function ToyForm({ toy, onSave, onCancel }) {
  const [form, setForm] = useState(toy || {
    name: '',
    price: 0,
    category: 'Action Figures',
    emoji: '🎁',
    badge: '',
    description: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: name === 'price' ? parseFloat(value) : value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form className="toy-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Name</label>
        <input name="name" value={form.name} onChange={handleChange} required />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Price ($)</label>
          <input name="price" type="number" step="0.01" value={form.price} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select name="category" value={form.category} onChange={handleChange}>
            {['Action Figures', 'Vehicles', 'Plush', 'Building Sets', 'Puzzles'].map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Emoji Icon</label>
          <input name="emoji" value={form.emoji} onChange={handleChange} required />
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
    const token = localStorage.getItem('token');
    fetch('/api/orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setOrders(data);
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
                <span className="order-total">${order.total_amount.toFixed(2)}</span>
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

function ContactUs({ currentUser }) {
  const [messages, setMessages] = useState([]);
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (currentUser) {
      const token = localStorage.getItem('token');
      fetch('/api/conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setMessages(data.messages || []));
    }
  }, [currentUser]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
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

  return (
    <div className="contact-page">
      <div className="contact-hero">
        <h1 className="hero-title">HAVE SOME <span className="gradient-text">QUESTIONS?</span></h1>
      </div>
      
      <div className="contact-grid-container">
        <div className="contact-illustration-side">
          <div className="contact-icon-wrapper">
            <span className="contact-large-icon">✉️</span>
          </div>
        </div>

        <div className="contact-form-side">
          {currentUser && messages.length > 0 && (
            <div className="chat-window">
              {messages.map((m, i) => (
                <div key={i} className={`chat-bubble-wrapper ${m.sender_role}`}>
                  <div className="bubble-header">
                    <span className="bubble-name">{m.sender_role === 'admin' ? 'Support Agent' : (currentUser?.username || 'User')}</span>
                    <span className="bubble-time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className={`chat-bubble ${m.sender_role}`}>
                    <div className="bubble-content">{m.content}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form className="contact-form" onSubmit={handleSubmit}>
            {!currentUser ? (
              <>
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
              </>
            ) : (
              // Logged in user: Chat style input if it feels like a conversation
              <div className="reply-form" style={{ padding: '0', border: 'none' }}>
                <div className="reply-input-wrapper">
                  <input value={content} onChange={e => setContent(e.target.value)} placeholder="Say something..." required />
                  <div className="reply-icons">
                    <span className="reply-icon" onClick={() => alert('Attachment feature coming soon!')}>📎</span>
                    <span className="reply-icon" onClick={() => alert('Emoji picker coming soon!')}>😊</span>
                  </div>
                </div>
                <button type="submit" className="send-btn-circle" aria-label="Send">
                  <span>➤</span>
                </button>
              </div>
            )}
            {status && <p className="status-msg">{status}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}

function AdminInbox() {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/conversations', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(setConversations);
  }, []);

  const handleSelect = (conv) => {
    setSelectedConv(conv);
    const token = localStorage.getItem('token');
    fetch(`/api/admin/conversations/${conv.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(setMessages);
  };

  const handleReply = (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    fetch(`/api/admin/conversations/${selectedConv.id}/reply`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content: reply })
    })
    .then(() => {
      setMessages(prev => [...prev, { content: reply, sender_role: 'admin', created_at: new Date().toISOString() }]);
      setReply('');
    });
  };

  return (
    <div className="inbox-page">
      <h2 className="section-title">Admin Inbox</h2>
      <div className="inbox-container">
        <div className="conv-list">
          {conversations.map(c => (
            <div key={c.id} className={`conv-item ${selectedConv?.id === c.id ? 'active' : ''}`} onClick={() => handleSelect(c)}>
              <div className="conv-user">{c.user_name || c.guest_email || 'Guest'}</div>
              <div className="conv-last">{c.last_message || 'No messages'}</div>
              <div className="conv-time">{new Date(c.updated_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div className="chat-area">
          {selectedConv ? (
            <>
              <div className="chat-window">
                {messages.map((m, i) => (
                  <div key={i} className={`chat-bubble-wrapper ${m.sender_role}`}>
                    <div className="bubble-header">
                      <span className="bubble-name">{m.sender_role === 'admin' ? 'You' : (selectedConv.user_name || 'Guest')}</span>
                      <span className="bubble-time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`chat-bubble ${m.sender_role}`}>
                      <div className="bubble-content">{m.content}</div>
                    </div>
                  </div>
                ))}
              </div>
              <form className="reply-form" onSubmit={handleReply}>
                <div className="reply-input-wrapper">
                  <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Say something..." required />
                  <div className="reply-icons">
                    <span className="reply-icon" title="Attach" onClick={() => alert('Attachment feature coming soon!')}>📎</span>
                    <span className="reply-icon" title="Image" onClick={() => alert('Image upload coming soon!')}>🖼️</span>
                    <span className="reply-icon" title="Emoji" onClick={() => alert('Emoji picker coming soon!')}>😊</span>
                    <span className="reply-icon" title="Voice" onClick={() => alert('Voice message coming soon!')}>🎤</span>
                    <span className="reply-icon" title="Camera" onClick={() => alert('Camera access coming soon!')}>📷</span>
                  </div>
                </div>
                <button type="submit" className="send-btn-circle" aria-label="Send">
                  <span>➤</span>
                </button>
              </form>
            </>
          ) : (
            <div className="empty-chat">Select a conversation to view.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminUsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setUsers(data);
      setLoading(false);
    })
    .catch(err => console.error(err));
  };

  const handleResetPassword = (userId) => {
    if (!confirm('Force this user to change password on next login?')) return;
    const token = localStorage.getItem('token');
    fetch(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      alert(data.message || 'Password reset flagged.');
      fetchUsers();
    })
    .catch(err => alert('Error: ' + err.message));
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
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
              <td>
                {u.must_reset_password ? 
                  <span style={{ color: '#ff4d4d', fontSize: '0.85rem' }}>⌛ Pending Reset</span> : 
                  <span style={{ color: '#2ecc71', fontSize: '0.85rem' }}>✓ Active</span>
                }
              </td>
              <td>
                <button 
                  className="edit-btn" 
                  onClick={() => handleResetPassword(u.id)}
                  style={{ background: '#f39c12' }}
                >
                  Reset Password
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;