const RADIUS_METERS = 50_000;
const OVERPASS_QUERY_TIMEOUT_SECONDS = 8;
const REQUEST_TIMEOUT_MS = 9_000;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 100;
const searchCache = new Map();

function isCoordinate(value, minimum, maximum) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function buildQuery(latitude, longitude) {
  return `
[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}];
(
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["office"~"agriculture|agricultural|agricultural_extension|agricultural_advisory",i];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["government"~"agriculture|agricultural_extension|agricultural_advisory",i];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["shop"~"agrarian|agricultural|agriculture|agro|seeds|garden_centre|plants|plant_nursery|farm",i];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["landuse"="plant_nursery"];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["landuse"="farmyard"];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["place"="farm"];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["name"~"agriculture|agricultural|agri|agro|farm|crop|nurser|garden cent(re|er)|plant nursery|seed|fertili[sz]er|pesticide|agrochemical|irrigation|tractor|farm machinery|farm equipment|mandi|agricultural market|co-?operative|krishi|kisan|कृषि|किसान|बीज|खाद|कीटनाशक|नर्सरी|मंडी|सहकारी|extension|kvk",i];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["marketplace"="agricultural"];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["amenity"="veterinary"];
);
out center tags;`;
}

function getCached(key) {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    searchCache.delete(key);
    return null;
  }
  return entry.elements;
}

function setCached(key, elements) {
  if (searchCache.size >= MAX_CACHE_ENTRIES) searchCache.delete(searchCache.keys().next().value);
  searchCache.set(key, { elements, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function fetchFromOverpass(endpoint, query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        'User-Agent': 'CropGuardAI/1.0 (nearby agriculture search)',
      },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.text()).replace(/\s+/g, ' ').slice(0, 250);
      throw Object.assign(new Error(`Overpass returned HTTP ${response.status}${body ? `: ${body}` : ''}`), {
        status: response.status,
      });
    }
    const data = await response.json();
    if (!Array.isArray(data.elements)) throw new Error('Overpass returned an invalid response');
    return data.elements;
  } finally {
    clearTimeout(timeout);
  }
}

exports.search = async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  if (!isCoordinate(latitude, -90, 90) || !isCoordinate(longitude, -180, 180)) {
    return res.status(400).json({ error: 'Choose a valid location and try again.' });
  }

  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cachedElements = getCached(cacheKey);
  if (cachedElements) return res.json({ elements: cachedElements });

  const query = buildQuery(latitude, longitude);
  const errors = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const elements = await fetchFromOverpass(endpoint, query);
      setCached(cacheKey, elements);
      return res.json({ elements });
    } catch (error) {
      errors.push(error);
    }
  }

  const timedOut = errors.some((error) => error.name === 'AbortError');
  if (timedOut) return res.status(504).json({ error: 'Nearby search took too long on the available map servers. Please retry.' });
  const rateLimited = errors.some((error) => error.status === 429);
  const rejected = errors.some((error) => error.status === 406);
  console.error('Nearby map search failed:', errors.map((error) => error.message).join('; '));
  if (rateLimited || rejected) {
    return res.status(503).json({ error: 'Nearby map servers are busy or limiting requests. Please wait a minute and retry.' });
  }
  return res.status(502).json({ error: 'Could not load nearby places from OpenStreetMap. Check your connection and retry.' });
};
