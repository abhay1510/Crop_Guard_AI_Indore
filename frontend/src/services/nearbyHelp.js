const RADIUS_METERS = 80_000;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const OVERPASS_REQUEST_TIMEOUT_MS = 15_000;
const OVERPASS_QUERY_TIMEOUT_SECONDS = 12;
const GEOCODER_TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 20;
const nearbyCache = new Map();
const placeCache = new Map();
const sharedNurseries = [{
  id: 'google-maps/kyari-nursery',
  name: 'Kyari',
  category: 'Plant nursery',
  location: { latitude: 22.7640334, longitude: 75.8987217 },
  mapUrl: 'https://maps.app.goo.gl/CSkow7DoVnPmUY7J7',
}];

function distanceMeters(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function elementLocation(element) {
  const center = element.center || element;
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lon)) return null;
  return { latitude: center.lat, longitude: center.lon };
}

function addressFrom(tags) {
  if (tags['addr:full']) return tags['addr:full'];
  return [
    [tags['addr:housenumber'], tags['addr:street'] || tags['addr:place']].filter(Boolean).join(' '),
    tags['addr:suburb'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
    tags['addr:state'],
    tags['addr:postcode'],
  ].filter(Boolean).join(', ');
}

function classify(tags) {
  const name = tags.name || tags['name:en'] || '';
  if (tags.amenity === 'veterinary' || /veterinary|vet clinic/i.test(name)) return 'Veterinary service';
  if (['garden_centre', 'plants'].includes(tags.shop) || tags.landuse === 'plant_nursery' || /nurser|नर्सरी/i.test(name)) return 'Plant nursery';
  if (/mandi|agricultural market|farmers'? market|co-?operative|co-?op|कृषि मंडी|मंडी|सहकारी/i.test(name)) return 'Agriculture market or cooperative';
  if (/tractor|farm machinery|agricultural machinery|farm equipment|कृषि यंत्र|ट्रैक्टर/i.test(name)) return 'Farm equipment';
  if (['agrarian', 'seeds'].includes(tags.shop)
    || /seed|fertili[sz]er|pesticide|agrochemical|agri.?input|irrigation|agro.?dealer|बीज|खाद|कीटनाशक|उर्वरक/i.test(name)) {
    return 'Agriculture supplier';
  }
  if (tags.landuse === 'farmyard' || tags.place === 'farm') return 'Farm';
  return 'Agriculture office or company';
}

function normalizeElement(element, origin) {
  const tags = element.tags || {};
  const location = elementLocation(element);
  if (!location) return null;
  const category = classify(tags);
  if (!tags.name && !['Plant nursery', 'Farm'].includes(category)) return null;
  const distance = distanceMeters(origin, location);
  if (distance > RADIUS_METERS) return null;
  return {
    id: `${element.type}/${element.id}`,
    name: tags.name || tags['name:en'] || (category === 'Plant nursery' ? 'Unnamed plant nursery' : 'Unnamed farm'),
    category,
    distanceKm: distance / 1000,
    location,
    address: addressFrom(tags),
  };
}

function getCached(cache, key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(cache, key, value) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function fetchJsonWithTimeout(url, options, timeoutMs, timeoutMessage, unavailableMessage, networkMessage = '') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(unavailableMessage);
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(timeoutMessage);
    if (error.name === 'TypeError' && networkMessage) throw new Error(networkMessage);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOverpass(query) {
  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const data = await fetchJsonWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: new URLSearchParams({ data: query }),
        },
        OVERPASS_REQUEST_TIMEOUT_MS,
        'The map server is taking too long. Please try again.',
        'The map server is busy. Trying another server.',
      );
      if (!Array.isArray(data.elements)) {
        throw new Error('Nearby services returned an unexpected response. Please try again.');
      }
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError?.message === 'The map server is taking too long. Please try again.') {
    throw new Error('Nearby search took too long on both map servers. Please retry.');
  }
  if (lastError?.message === 'The map server is busy. Trying another server.') {
    throw new Error('Both map servers are busy. Please retry in a moment.');
  }
  if (lastError?.name === 'TypeError') {
    throw new Error('Could not reach OpenStreetMap. Check your internet connection and retry.');
  }
  throw lastError || new Error('Nearby services could not be loaded. Please try again.');
}

function formatPlaces(elements, origin) {
  const unique = new Map();
  elements.forEach((element) => {
    const place = normalizeElement(element, origin);
    if (place) unique.set(place.id, place);
  });
  sharedNurseries.forEach((nursery) => {
    const distance = distanceMeters(origin, nursery.location);
    if (distance <= RADIUS_METERS && !unique.has(nursery.id)) {
      unique.set(nursery.id, {
        ...nursery,
        distanceKm: distance / 1000,
        address: '',
      });
    }
  });
  return [...unique.values()].sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function searchNearbyHelp(origin) {
  const { latitude, longitude } = origin;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('Choose a valid location and try again.');
  }

  const cacheKey = `v5-radius-${RADIUS_METERS}:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cachedElements = getCached(nearbyCache, cacheKey);
  if (cachedElements) return formatPlaces(cachedElements, origin);

  const query = `
[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}];
(
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["office"~"agriculture|agricultural|agricultural_extension|agricultural_advisory",i];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["government"~"agriculture|agricultural_extension|agricultural_advisory",i];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["shop"~"agrarian|seeds|garden_centre|plants|farm",i];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["landuse"="plant_nursery"];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["landuse"="farmyard"];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["place"="farm"];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["name"~"agriculture|agricultural|agri|agro|nurser|garden cent(re|er)|plant nursery|nursar|seed|fertili[sz]er|pesticide|agrochemical|irrigation|tractor|farm machinery|farm equipment|mandi|agricultural market|co-?operative|krishi|kisan|कृषि|किसान|बीज|खाद|कीटनाशक|नर्सरी|मंडी|सहकारी|extension|kvk",i];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["office"="company"]["name"~"agriculture|agricultural|agri|agro|seed|fertili[sz]er|pesticide|agrochemical|irrigation|tractor|nurser|machinery|equipment|mandi|co-?operative|krishi|kisan|कृषि|किसान|बीज|खाद|कीटनाशक|नर्सरी|मंडी|सहकारी|extension|kvk",i];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["shop"]["name"~"agriculture|agricultural|agri|agro|seed|fertili[sz]er|pesticide|agrochemical|irrigation|tractor|nurser|machinery|equipment|mandi|co-?operative|krishi|kisan|कृषि|किसान|बीज|खाद|कीटनाशक|नर्सरी|मंडी|सहकारी|extension|kvk",i];
  nwr(around:${RADIUS_METERS},${latitude},${longitude})["amenity"="veterinary"];
);
out center tags;`;

  const data = await fetchOverpass(query);

  setCached(nearbyCache, cacheKey, data.elements);
  return formatPlaces(data.elements, origin);
}

export async function findPlace(query) {
  const trimmed = query.trim();
  if (!trimmed) throw new Error('Enter a village, town or district to search.');
  const cacheKey = trimmed.toLocaleLowerCase();
  const cachedPlace = getCached(placeCache, cacheKey);
  if (cachedPlace) return cachedPlace;

  const params = new URLSearchParams({ q: trimmed, format: 'jsonv2', limit: '1' });
  const results = await fetchJsonWithTimeout(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {},
    GEOCODER_TIMEOUT_MS,
    'Location search is taking too long. Please try again.',
    'That location could not be searched. Please try again.',
    'Could not reach location search. Check your internet connection and retry.',
  );
  const latitude = Number(results[0]?.lat);
  const longitude = Number(results[0]?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('No matching place was found. Check the spelling and try again.');
  }
  const place = { latitude, longitude, label: results[0].display_name };
  setCached(placeCache, cacheKey, place);
  return place;
}
