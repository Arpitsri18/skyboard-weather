/* =========================================================
   SKYBOARD — city weather board (frontend)
   OpenWeatherMap requests go through backend/server.js so the
   API key stays in backend/.env and never reaches the browser.
   Run from backend:  cd backend && npm start  →  http://localhost:5001
========================================================= */

const els = {
  form: document.getElementById("searchForm"),
  cityInput: document.getElementById("city"),
  status: document.getElementById("statusLine"),
  bgPhoto: document.getElementById("bgPhoto"),
  photoCredit: document.getElementById("photoCredit"),
  heroRegion: document.getElementById("heroRegion"),
  cityName: document.getElementById("cityName"),
  placeDesc: document.getElementById("placeDesc"),
  icon: document.getElementById("weatherIcon"),
  temp: document.getElementById("temp"),
  tempMin: document.getElementById("temp_min"),
  tempMax: document.getElementById("temp_max"),
  condition: document.getElementById("condition"),
  humidity: document.getElementById("humidity"),
  cloudPct: document.getElementById("cloud_pct"),
  pressure: document.getElementById("pressure"),
  seaLevel: document.getElementById("sea_level"),
  grndLevel: document.getElementById("grnd_level"),
  windSpeed: document.getElementById("wind_speed"),
  windDeg: document.getElementById("wind_deg"),
  windCompass: document.getElementById("wind_compass"),
  windGust: document.getElementById("wind_gust"),
  rainStrip: document.getElementById("rainStrip"),
  rainIcon: document.getElementById("rainIcon"),
  rainVerdict: document.getElementById("rainVerdict"),
  rainDetail: document.getElementById("rainDetail"),
  rainChance: document.getElementById("rainChance"),
};

const CONDITION_GRADIENTS = {
  clear:   "linear-gradient(160deg,#1e3a5f,#3f6b8f 55%,#e8a95c)",
  clouds:  "linear-gradient(160deg,#232733,#3a4152 60%,#5b6376)",
  rain:    "linear-gradient(160deg,#111826,#22354a 60%,#2f4a63)",
  drizzle: "linear-gradient(160deg,#131b28,#243a4f 60%,#33536e)",
  thunderstorm: "linear-gradient(160deg,#0d0f16,#1c2130 55%,#3a2f52)",
  snow:    "linear-gradient(160deg,#26313f,#5c7488 55%,#dfe8ee)",
  mist:    "linear-gradient(160deg,#232830,#454c58 60%,#727a86)",
  default: "linear-gradient(160deg,#1a1d24,#2c313d 60%,#454c58)",
};

const WIND_COMPASS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const compassFromDeg = (deg) => WIND_COMPASS[Math.round(deg / 22.5) % 16];

function countryName(code) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle("error", isError);
}

function flip(el, value) {
  el.textContent = value;
  const target = el.closest(".row-value") || el;
  target.classList.remove("flip");
  void target.offsetWidth;
  target.classList.add("flip");
}

function spellingVariants(query) {
  const variants = [query];
  const lower = query.toLowerCase();
  if (lower.includes("v")) variants.push(query.replace(/v/gi, (m) => (m === "v" ? "w" : "W")));
  if (lower.includes("w")) variants.push(query.replace(/w/gi, (m) => (m === "w" ? "v" : "V")));
  return [...new Set(variants)];
}

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z]/g, "");
}

function similarity(a, b) {
  a = normalize(a); b = normalize(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.includes(shorter)) return shorter.length / longer.length;
  let matches = 0;
  const bChars = b.split("");
  for (const ch of a) {
    const idx = bChars.indexOf(ch);
    if (idx !== -1) { matches++; bChars.splice(idx, 1); }
  }
  return matches / longer.length;
}

async function geocodeOpenMeteo(query) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results?.length) return null;

    let best = data.results[0];
    let bestScore = similarity(query, best.name);
    for (const r of data.results) {
      const score = similarity(query, r.name);
      if (score > bestScore) { best = r; bestScore = score; }
    }
    return {
      name: best.name,
      state: best.admin1 || null,
      country: best.country_code || null,
      lat: best.latitude,
      lon: best.longitude,
    };
  } catch {
    return null;
  }
}

async function geocodeNominatim(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    const hit = data[0];
    const addr = hit.address || {};
    return {
      name: hit.name || hit.display_name?.split(",")[0] || query,
      state: addr.state || addr.region || null,
      country: (addr.country_code || "").toUpperCase() || null,
      lat: parseFloat(hit.lat),
      lon: parseFloat(hit.lon),
    };
  } catch {
    return null;
  }
}

async function geocodeOWM(query) {
  try {
    const url = `/api/geocode?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    const hit = data[0];
    return {
      name: hit.name,
      state: hit.state || null,
      country: hit.country || null,
      lat: hit.lat,
      lon: hit.lon,
    };
  } catch {
    return null;
  }
}

async function tryProvider(provider, variants) {
  for (const variant of variants) {
    const hit = await provider(variant);
    if (hit) return hit;
  }
  return null;
}

async function geocodeCity(query) {
  const variants = spellingVariants(query);

  // ✅ Try backend geocode first
  let hit = await tryProvider(geocodeOWM, variants);
  if (hit) return hit;

  // Then fall back to OpenMeteo
  hit = await tryProvider(geocodeOpenMeteo, variants);
  if (hit) return hit;

  // Then fall back to Nominatim
  hit = await tryProvider(geocodeNominatim, variants);
  if (hit) return hit;

  // Extra fallback: append ",IN" for Indian cities
  if (!/,/.test(query)) {
    hit = await geocodeOWM(`${query},IN`);
    if (hit) return hit;
    for (const variant of variants) {
      if (variant !== query) {
        hit = await geocodeOWM(`${variant},IN`);
        if (hit) return hit;
      }
    }
  }

  return null;
}

async function wikipediaQuery(candidate) {
  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: candidate,
      gsrlimit: "1",
      prop: "pageimages|extracts",
      exintro: "1",
      explaintext: "1",
      exchars: "400",
      pithumbsize: "1600",
      format: "json",
      origin: "*",
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) return null;
    const img = page.thumbnail?.source || page.original?.source || null;
    if (!img) return null;
    return {
      url: img,
      title: page.title,
      extract: page.extract || "",
      matchedLevel: candidate,
    };
  } catch {
    return null;
  }
}

function staticMapUrl(lat, lon) {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=11&size=1200x700&maptype=mapnik`;
}

async function getPlacePhoto({ name, state, country, lat, lon }) {
  const countryFull = country ? countryName(country) : "";
  const candidates = [
    name,
    state ? `${name}, ${state}` : null,
    state || null,
    countryFull || null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = await wikipediaQuery(candidate);
    if (result) return result;
  }

  return {
    url: staticMapUrl(lat, lon),
    title: name,
    extract: "",
    matchedLevel: "map",
    isMap: true,
  };
}

function applyBackground(conditionKey, photoUrl) {
  const gradient = CONDITION_GRADIENTS[conditionKey] || CONDITION_GRADIENTS.default;
  els.bgPhoto.style.background = gradient;
  if (photoUrl) {
    const img = new Image();
    img.onload = () => {
      els.bgPhoto.style.backgroundImage = `url("${photoUrl}")`;
    };
    img.src = photoUrl;
  } else {
    els.bgPhoto.style.backgroundImage = "none";
  }
}

function isRainCode(code) {
  return code >= 200 && code < 600;
}

async function getRainOutlook(lat, lon) {
  els.rainStrip.dataset.state = "unknown";
  els.rainVerdict.textContent = "CHECKING TODAY'S RAIN…";
  els.rainDetail.textContent = "";
  els.rainChance.textContent = "--%";
  els.rainIcon.textContent = "☂";

  try {
    const url = `/api/forecast?lat=${lat}&lon=${lon}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("forecast unavailable");
    const data = await res.json();

    const offsetSeconds = data.city?.timezone ?? 0;
    const nowLocal = new Date(Date.now() + offsetSeconds * 1000);
    const todayKey = nowLocal.toISOString().slice(0, 10);

    const todaysSlots = data.list.filter((slot) => slot.dt_txt.startsWith(todayKey));
    const slots = todaysSlots.length ? todaysSlots : data.list.slice(0, 4);

    let maxPop = 0;
    let rainLikely = false;
    slots.forEach((slot) => {
      maxPop = Math.max(maxPop, slot.pop ?? 0);
      if (slot.weather?.some((w) => isRainCode(w.id))) rainLikely = true;
    });

    const chancePct = Math.round(maxPop * 100);
    const willRain = rainLikely || chancePct >= 40;

    els.rainStrip.dataset.state = willRain ? "yes" : "no";
    els.rainIcon.textContent = willRain ? "🌧" : "☀";
    els.rainVerdict.textContent = willRain ? "RAIN EXPECTED TODAY" : "NO RAIN EXPECTED TODAY";
    els.rainDetail.textContent = todaysSlots.length
      ? "Based on today's 3-hour forecast"
      : "Based on the next few hours (limited data)";
    els.rainChance.textContent = `${chancePct}%`;
  } catch (err) {
    console.error("Error fetching rain outlook:", err);
    els.rainStrip.dataset.state = "unknown";
    els.rainVerdict.textContent = "RAIN OUTLOOK UNAVAILABLE";
    els.rainDetail.textContent = "";
    els.rainChance.textContent = "--%";
  }
}

function resetBoard() {
  els.heroRegion.textContent = "—";
  els.cityName.textContent = "—";
  els.placeDesc.textContent = "Try another spelling, or add the state/country.";
  els.icon.removeAttribute("src");
  els.condition.textContent = "—";
  els.temp.textContent = "--";
  els.tempMin.textContent = "--";
  els.tempMax.textContent = "--";
  ["humidity","cloudPct","pressure","seaLevel","grndLevel","windSpeed","windDeg","windGust"]
    .forEach((k) => { els[k].textContent = k === "seaLevel" || k === "grndLevel" || k === "windGust" ? "N/A" : "--"; });
  els.windCompass.textContent = "";
  els.rainStrip.dataset.state = "unknown";
  els.rainVerdict.textContent = "—";
  els.rainDetail.textContent = "";
  els.rainChance.textContent = "--%";
  applyBackground("default");
  els.photoCredit.textContent = "";
}

function loadPlacePhoto({ name, state, country, lat, lon }, conditionKey) {
  getPlacePhoto({ name, state, country, lat, lon }).then((photo) => {
    if (!photo) return;
    applyBackground(conditionKey, photo.url);
    if (photo.isMap) {
      els.placeDesc.textContent = `Current conditions in ${name}.`;
      els.photoCredit.textContent = "Map: OpenStreetMap — no photo was available for this place";
    } else if (photo.extract) {
      els.placeDesc.textContent = photo.extract.split(". ").slice(0, 2).join(". ") + ".";
      els.photoCredit.textContent = `Photo: ${photo.title} — Wikipedia`;
    } else {
      els.placeDesc.textContent = `A look at ${photo.title}.`;
      els.photoCredit.textContent = `Photo: ${photo.title} — Wikipedia`;
    }
  }).catch((err) => {
    console.error("Error loading place photo:", err);
    applyBackground(conditionKey, staticMapUrl(lat, lon));
    els.photoCredit.textContent = "Map: OpenStreetMap — no photo was available for this place";
  });
}

async function getWeather(cityQuery) {
  if (!cityQuery || !cityQuery.trim()) cityQuery = "Delhi";
  setStatus(`Looking up ${cityQuery}…`);

  const place = await geocodeCity(cityQuery);
  if (!place) {
    setStatus(`Couldn't find "${cityQuery}". Try adding the state or country, e.g. "Shrawasti, Uttar Pradesh".`, true);
    resetBoard();
    return;
  }

  const { name, state, country, lat, lon } = place;

  let response;
  try {
    const url = `/api/weather?lat=${lat}&lon=${lon}`;
    const res = await fetch(url);
    if (!res.ok) {
      setStatus(`Weather service error (${res.status}). Try again shortly.`, true);
      resetBoard();
      return;
    }
    response = await res.json();
  } catch (err) {
    console.error("Error fetching weather:", err);
    setStatus("Network error — check your connection and try again.", true);
    resetBoard();
    return;
  }

  setStatus("");

  const conditionMain = response.weather[0].main;
  const conditionKey = conditionMain.toLowerCase();
  const iconCode = response.weather[0].icon;

  const countryFull = country ? countryName(country) : "";
  els.heroRegion.textContent = state ? `${state.toUpperCase()} · ${countryFull.toUpperCase()}` : countryFull.toUpperCase() || "—";
  els.cityName.textContent = name || response.name || cityQuery;
  els.icon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  els.icon.alt = response.weather[0].description;
  els.condition.textContent = response.weather[0].description;
  flip(els.temp, Math.round(response.main.temp));
  els.tempMin.textContent = Math.round(response.main.temp_min);
  els.tempMax.textContent = Math.round(response.main.temp_max);

  flip(els.humidity, response.main.humidity);
  flip(els.cloudPct, response.clouds.all);
  flip(els.pressure, response.main.pressure);
  flip(els.seaLevel, response.main.sea_level ?? "N/A");
  flip(els.grndLevel, response.main.grnd_level ?? "N/A");
  flip(els.windSpeed, (response.wind.speed * 3.6).toFixed(1));
  flip(els.windDeg, response.wind.deg ?? "--");
  els.windCompass.textContent = response.wind.deg != null ? ` ${compassFromDeg(response.wind.deg)}` : "";
  flip(els.windGust, response.wind.gust != null ? (response.wind.gust * 3.6).toFixed(1) + " km/h" : "N/A");

  getRainOutlook(lat, lon);

  applyBackground(conditionKey);
  loadPlacePhoto({ name: name || response.name, state, country, lat, lon }, conditionKey);
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  getWeather(els.cityInput.value);
});

window.addEventListener("DOMContentLoaded", () => {
  getWeather("Delhi");
});
