import './component.css';

function StarRating({ rating }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <div className="star-rating" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        if (i < full) return <span key={i} className="star full">★</span>;
        if (i === full && half) return <span key={i} className="star half">★</span>;
        return <span key={i} className="star empty">★</span>;
      })}
      <span className="rating-value">{rating}</span>
    </div>
  );
}

export default function ToyCard({ toy, onAddToCart }) {
  return (
    <div className="toy-card">
      {toy.badge && (
        <span className={`toy-badge badge-${toy.badge.toLowerCase()}`}>{toy.badge}</span>
      )}

      <div className="toy-emoji-wrap">
        <span className="toy-emoji">{toy.emoji}</span>
      </div>

      <div className="toy-info">
        <p className="toy-category">{toy.category}</p>
        <h3 className="toy-name">{toy.name}</h3>

        <StarRating rating={toy.rating} />
        <p className="toy-reviews">{toy.reviews} reviews</p>

        <div className="toy-footer">
          <span className="toy-price">${toy.price.toFixed(2)}</span>
          <button
            className="toy-btn"
            onClick={() => onAddToCart(toy)}
            id={`add-to-cart-${toy.id}`}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}