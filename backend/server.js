const express = require ("express");
const cors = require ("cors");

//create the app 
const app = express();

//middleware
app.use(cors());
app.use(express.json());

//health check route
app.get ('/api/health', (req, res) => {
    res.json({ status: "OK", message: "Backend is running well!"});
});

//example API Route
app.get ('/api/toys', (req, res) => {
    res.json([
    { id: 1, name: "Lego City Set", price: 49.9 },
    { id: 2, name: "Teddy Bear", price: 19.9 },
    { id: 3, name: "Remote Control Car", price: 29.9 },
  ]);
});

const PORT = 5000;
app.listen( PORT, ()=>{
    console.log(`backend is running on: http://localhost:${PORT}`);
});