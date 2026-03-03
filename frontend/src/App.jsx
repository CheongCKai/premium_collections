import { useEffect, useState } from 'react';
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

  useEffect(() => {
    fetch('/api/toys')
      .then((res) => res.json())
      .then((data) => setToys(data))
      .catch((err) => console.error('Fetch error:', err));
  }, []);

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
  };

  // ── Cart Handlers ──
  const handleAddToCart = (toy) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.toy.id === toy.id);
      if (existing) return prev.map((item) => item.toy.id === toy.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { toy, qty: 1 }];
    });
    setCartBump(true);
    setTimeout(() => setCartBump(false), 300);
  };

  const handleUpdateQty = (toyId, newQty) => {
    if (newQty <= 0) setCartItems((prev) => prev.filter((item) => item.toy.id !== toyId));
    else setCartItems((prev) => prev.map((item) => item.toy.id === toyId ? { ...item, qty: newQty } : item));
  };

  const handleRemove = (toyId) => setCartItems((prev) => prev.filter((item) => item.toy.id !== toyId));
  const totalCartCount = cartItems.reduce((sum, item) => sum + item.qty, 0);

  const handleCheckout = () => {
    if (!currentUser) {
      setCartOpen(false); // Close cart sidebar
      setIsAuthOpen(true); // Open auth modal
    } else {
      alert(`Thank you for your purchase, ${currentUser.name}! (Checkout flow mock)`);
      setCartItems([]);
      setCartOpen(false);
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
          {currentUser ? (
            <div className="navbar-user">
              <span className="user-avatar">{currentUser.name.charAt(0).toUpperCase()}</span>
              <span className="user-name">{currentUser.name}</span>
              {currentUser.role === 'admin' && <span className="admin-badge">Admin</span>}
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
      <main className="collection-section">
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

export default App;