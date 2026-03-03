import './CartSidebar.css';

export default function CartSidebar({ isOpen, onClose, cartItems, onUpdateQty, onRemove, onCheckout }) {
  const total = cartItems.reduce((sum, item) => sum + item.toy.price * item.qty, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.qty, 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`cart-backdrop${isOpen ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar Drawer */}
      <aside className={`cart-sidebar${isOpen ? ' open' : ''}`} aria-label="Shopping Cart">
        {/* Header */}
        <div className="cart-header">
          <div className="cart-header-left">
            <span className="cart-header-icon">🛒</span>
            <div>
              <h2 className="cart-title">Your Cart</h2>
              <p className="cart-subtitle">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button className="cart-close-btn" onClick={onClose} aria-label="Close cart">✕</button>
        </div>

        {/* Items */}
        <div className="cart-body">
          {cartItems.length === 0 ? (
            <div className="cart-empty">
              <div className="cart-empty-icon">🛍️</div>
              <p>Your cart is empty</p>
              <span>Add some toys to get started!</span>
            </div>
          ) : (
            <ul className="cart-list">
              {cartItems.map(({ toy, qty }) => (
                <li key={toy.id} className="cart-item">
                  <div className="cart-item-emoji">{toy.emoji}</div>
                  <div className="cart-item-info">
                    <p className="cart-item-name">{toy.name}</p>
                    <p className="cart-item-unit">${toy.price.toFixed(2)} each</p>
                    <div className="cart-item-controls">
                      <button
                        className="qty-btn"
                        onClick={() => onUpdateQty(toy.id, qty - 1)}
                        aria-label="Decrease quantity"
                      >−</button>
                      <span className="qty-value">{qty}</span>
                      <button
                        className="qty-btn"
                        onClick={() => onUpdateQty(toy.id, qty + 1)}
                        aria-label="Increase quantity"
                      >+</button>
                    </div>
                  </div>
                  <div className="cart-item-right">
                    <p className="cart-item-subtotal">${(toy.price * qty).toFixed(2)}</p>
                    <button
                      className="remove-btn"
                      onClick={() => onRemove(toy.id)}
                      aria-label="Remove item"
                    >🗑️</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total-row">
              <span className="cart-total-label">Total</span>
              <span className="cart-total-price">${total.toFixed(2)}</span>
            </div>
            <button className="checkout-btn" onClick={onCheckout}>Proceed to Checkout →</button>
          </div>
        )}
      </aside>
    </>
  );
}
