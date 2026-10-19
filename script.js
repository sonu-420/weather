const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Heavy showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm with hail"
};

const elements = {
  form: document.querySelector("#search-form"),
  cityInput: document.querySelector("#city-input"),
  locationBtn: document.querySelector("#location-btn"),
  status: document.querySelector("#status"),
  locationName: document.querySelector("#location-name"),
  localTime: document.querySelector("#local-time"),
  condition: document.querySelector("#condition"),
  temperature: document.querySelector("#temperature"),
  feelsLike: document.querySelector("#feels-like"),
  highlights: document.querySelector("#highlights"),
  hourlyList: document.querySelector("#hourly-list"),
  dailyList: document.querySelector("#daily-list")
};

const dayFormatter = new Intl.DateTimeFormat([], { weekday: "short" });
const timeFormatter = new Intl.DateTimeFormat([], { hour: "numeric" });
const longTimeFormatter = new Intl.DateTimeFormat([], {
  weekday: "long",
  hour: "numeric",
  minute: "2-digit"
});

function formatTemp(value) {
  return `${Math.round(value)}°C`;
}

function weatherLabel(code) {
  return WEATHER_CODES[code] || "Unknown conditions";
}

function setStatus(message, type = "info") {
  elements.status.textContent = message;
  elements.status.className = `status ${type === "error" ? "error" : ""}`.trim();
}

function updateLocationLabel(location) {
  const parts = [location.name, location.admin1, location.country].filter(Boolean);
  elements.locationName.textContent = parts.join(", ");
}

function renderHighlights(data) {
  const cards = [
    { label: "Humidity", value: `${data.current.relative_humidity_2m}%` },
    { label: "Wind", value: `${Math.round(data.current.wind_speed_10m)} km/h` },
    { label: "Cloud Cover", value: `${data.current.cloud_cover}%` },
    { label: "Precip Chance", value: `${data.daily.precipitation_probability_max[0]}%` },
    { label: "UV Index", value: `${Math.round(data.daily.uv_index_max[0])}` },
    {
      label: "Sunrise/Sunset",
      value: `${formatClock(data.daily.sunrise[0])} / ${formatClock(data.daily.sunset[0])}`
    }
  ];

  elements.highlights.innerHTML = cards
    .map((card) => {
      return `
        <article class="highlight">
          <p class="label">${card.label}</p>
          <p class="value">${card.value}</p>
        </article>
      `;
    })
    .join("");
}

function formatClock(value) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function renderCurrent(data) {
  const currentTime = new Date(data.current.time);

  elements.localTime.textContent = longTimeFormatter.format(currentTime);
  elements.condition.textContent = weatherLabel(data.current.weather_code);
  elements.temperature.textContent = formatTemp(data.current.temperature_2m);
  elements.feelsLike.textContent = `Feels like ${formatTemp(data.current.apparent_temperature)}`;
}

function renderHourly(data) {
  const hourly = data.hourly;
  const currentIdx = Math.max(0, hourly.time.indexOf(data.current.time));
  const maxItems = Math.min(currentIdx + 12, hourly.time.length);
  const items = [];

  for (let i = currentIdx; i < maxItems; i += 1) {
    items.push({
      time: hourly.time[i],
      temp: hourly.temperature_2m[i],
      code: hourly.weather_code[i]
    });
  }

  elements.hourlyList.innerHTML = items
    .map((item) => {
      return `
        <article class="hour-card">
          <p class="hour-time">${timeFormatter.format(new Date(item.time))}</p>
          <p class="hour-temp">${formatTemp(item.temp)}</p>
          <p class="hour-text">${weatherLabel(item.code)}</p>
        </article>
      `;
    })
    .join("");
}

function renderDaily(data) {
  const daily = data.daily;
  const maxDays = Math.min(7, daily.time.length);
  const items = [];

  for (let i = 0; i < maxDays; i += 1) {
    items.push({
      date: daily.time[i],
      code: daily.weather_code[i],
      min: daily.temperature_2m_min[i],
      max: daily.temperature_2m_max[i],
      rainChance: daily.precipitation_probability_max[i]
    });
  }

  elements.dailyList.innerHTML = items
    .map((item, index) => {
      const dayText = index === 0 ? "Today" : dayFormatter.format(new Date(item.date));
      return `
        <article class="day-card">
          <div>
            <p class="day-name">${dayText}</p>
            <p class="day-text">${weatherLabel(item.code)}</p>
          </div>
          <p class="day-text">Rain ${item.rainChance}%</p>
          <p class="day-temp">${formatTemp(item.max)} / ${formatTemp(item.min)}</p>
        </article>
      `;
    })
    .join("");
}

async function geocodeCity(city) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not find that city right now.");
  }

  const data = await response.json();
  const location = data.results?.[0];
  if (!location) {
    throw new Error(`No matching city found for "${city}".`);
  }

  return location;
}

async function fetchForecast(latitude, longitude, timezone = "auto") {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude);
  url.searchParams.set("longitude", longitude);
  url.searchParams.set("timezone", timezone);
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "cloud_cover",
      "wind_speed_10m",
      "weather_code"
    ].join(",")
  );
  url.searchParams.set(
    "hourly",
    ["temperature_2m", "weather_code"].join(",")
  );
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "uv_index_max",
      "sunrise",
      "sunset"
    ].join(",")
  );

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Forecast service is unavailable right now.");
  }

  return response.json();
}

async function loadAndRender(location) {
  setStatus("Loading forecast...");

  try {
    const data = await fetchForecast(location.latitude, location.longitude, location.timezone || "auto");
    updateLocationLabel(location);
    renderCurrent(data);
    renderHighlights(data);
    renderHourly(data);
    renderDaily(data);
    setStatus(`Updated at ${formatClock(new Date().toISOString())}`);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function handleSearch(event) {
  event.preventDefault();
  const city = elements.cityInput.value.trim();

  if (!city) {
    setStatus("Type a city name first.", "error");
    return;
  }

  try {
    setStatus("Searching city...");
    const location = await geocodeCity(city);
    await loadAndRender(location);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function handleCurrentLocation() {
  if (!navigator.geolocation) {
    setStatus("Geolocation is not supported in this browser.", "error");
    return;
  }

  setStatus("Getting your current location...");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const coords = position.coords;
      await loadAndRender({
        name: "Your Location",
        country: "",
        admin1: "",
        latitude: coords.latitude,
        longitude: coords.longitude,
        timezone: "auto"
      });
    },
    () => {
      setStatus("Location access was blocked. Search for a city instead.", "error");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function init() {
  elements.form.addEventListener("submit", handleSearch);
  elements.locationBtn.addEventListener("click", handleCurrentLocation);

  loadAndRender({
    name: "Lucknow",
    country: "India",
    admin1: "Uttar Pradesh",
    latitude: 26.8393,
    longitude: 80.9231,
    timezone: "Asia/Kolkata"
  });
}

init();