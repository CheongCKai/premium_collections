import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import ToyCard from "./component/toyCard";

function App() {
  const [toys, setToys] = useState([]);
   useEffect(() => {
  fetch("/api/toys")
    .then((res) => {
      console.log("Status:", res.status);
      return res.json();
    })
    .then((data) => {
      console.log("Data from backend:", data);
      setToys(data);
    })
    .catch((err) => console.error("Fetch error:", err));
}, []);

  return (
    <>
    <div style={{padding: 20}}></div>
     <h1>Premium Collection Toy Shop</h1>

      <div className='toy-grid'>
        {toys.map((toy) => (
          <ToyCard key={toy.id} toy={toy} />
        ))}
      </div>
    </>
  )
}

export default App

      // <div>
      //   <a href="https://vite.dev" target="_blank">
      //     <img src={viteLogo} className="logo" alt="Vite logo" />
      //   </a>
      //   <a href="https://react.dev" target="_blank">
      //     <img src={reactLogo} className="logo react" alt="React logo" />
      //   </a>
      // </div>
      // <h1>Vite + React</h1>
      // <div className="card">
      //   <button onClick={() => setCount((count) => count + 1)}>
      //     count is {count}
      //   </button>
      //   <p>
      //     Edit <code>src/App.jsx</code> and save to test HMR
      //   </p>
      // </div>
      // <p className="read-the-docs">
      //   Click on the Vite and React logos to learn more
      // </p>