// Load environment variables first
require("dotenv").config();

const express = require("express");
const path = require("path");

// Debug: confirm API key is loaded
console.log("Loaded API key:", process.env.OWM_API_KEY);

const app = express();
const PORT = process.env.PORT || 5001; // default to 5001 to avoid conflicts
const API_KEY = process.env.OWM_API_KEY;
const frontendPath = path.join(__dirname, "../frontend");

// Exit if API key is missing
if (!API_KEY) {
  console.error("❌ Missing OWM_API_KEY in backend/.env — copy .env.example and add your key.");
  process.exit(1);
}

// Serve frontend files
app.use(express.static(frontendPath));

// Helper to fetch OpenWeatherMap
async function fetchOWM(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Geocoding endpoint
app.get("/api/geocode", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing q parameter" });

  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${API_KEY}`;
  const { ok, status, data } = await fetchOWM(url);
  res.status(ok ? 200 : status).json(data);
});

// Current weather endpoint
app.get("/api/weather", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "Missing lat or lon" });

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
  const { ok, status, data } = await fetchOWM(url);
  res.status(ok ? 200 : status).json(data);
});

// Forecast endpoint
app.get("/api/forecast", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "Missing lat or lon" });

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
  const { ok, status, data } = await fetchOWM(url);
  res.status(ok ? 200 : status).json(data);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ SKYBOARD running at http://localhost:${PORT}`);
});
