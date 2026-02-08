import "../component/component.css";
export default function ToyCard ({ toy, onAddToCart}){
    return (
        <div className="toy-card">
            <h3 className="toy-title">
                {toy.name}
            </h3>
            <p className="toy-price">$(toy.price.toFixed(2))</p>

            <button className="toy-button"
            onClick={()=> onAddToCart}>
                Add to Cart
            </button>
        </div>
    )
}