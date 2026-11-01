import { api } from './api.js';

const RADIUS_METERS = 50_000;
const MAX_RESULTS = 10;
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

const demoLocations = [
  {
    id: 'demo/bhopal-1',
    name: 'Hackathon Demo Agriculture Help Point 1 — Bhopal',
    category: 'Agriculture office or company',
    location: { latitude: 23.2151, longitude: 77.4001 },
    address: 'Sample point near Kolar Road, Bhopal, Madhya Pradesh',
  },
  {
    id: 'demo/bhopal-2',
    name: 'Hackathon Demo Plant Nursery — Bhopal',
    category: 'Plant nursery',
    location: { latitude: 23.2861, longitude: 77.3982 },
    address: 'Sample point near Arera Colony, Bhopal, Madhya Pradesh',
  },
  {
    id: 'demo/bhopal-3',
    name: 'Hackathon Demo Agriculture Supplier — Bhopal',
    category: 'Agriculture supplier',
    location: { latitude: 23.2668, longitude: 77.4670 },
    address: 'Sample point near Govindpura, Bhopal, Madhya Pradesh',
  },
  {
    id: 'demo/bhopal-4',
    name: 'Hackathon Demo Farm Equipment — Bhopal',
    category: 'Farm equipment',
    location: { latitude: 23.2033, longitude: 77.3507 },
    address: 'Sample point near Bairagarh, Bhopal, Madhya Pradesh',
  },
  {
    id: 'demo/bhopal-5',
    name: 'Hackathon Demo Agriculture Market — Bhopal',
    category: 'Agriculture market or cooperative',
    location: { latitude: 23.4271, longitude: 77.4948 },
    address: 'Sample point near Bhopal, Madhya Pradesh',
  },
  {
    id: 'demo/indore-1',
    name: 'Hackathon Demo Agriculture Help Point 1 — Indore',
    category: 'Agriculture office or company',
    location: { latitude: 22.7196, longitude: 75.8577 },
    address: 'Sample point in Indore, Madhya Pradesh',
  },
  {
    id: 'demo/indore-2',
    name: 'Hackathon Demo Plant Nursery — Indore',
    category: 'Plant nursery',
    location: { latitude: 22.7520, longitude: 75.8937 },
    address: 'Sample point near Vijay Nagar, Indore, Madhya Pradesh',
  },
  {
    id: 'demo/indore-3',
    name: 'Hackathon Demo Agriculture Supplier — Indore',
    category: 'Agriculture supplier',
    location: { latitude: 22.6842, longitude: 75.8330 },
    address: 'Sample point near Rajendra Nagar, Indore, Madhya Pradesh',
  },
  {
    id: 'demo/indore-4',
    name: 'Hackathon Demo Farm Equipment — Indore',
    category: 'Farm equipment',
    location: { latitude: 22.5676, longitude: 75.7570 },
    address: 'Sample point near Mhow, Madhya Pradesh',
  },
  {
    id: 'demo/indore-5',
    name: 'Hackathon Demo Agriculture Market — Indore',
    category: 'Agriculture market or cooperative',
    location: { latitude: 22.9774, longitude: 75.8275 },
    address: 'Sample point near Sanwer, Madhya Pradesh',
  },
];

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
  if (['garden_centre', 'plants', 'plant_nursery'].includes(tags.shop)
    || tags.landuse === 'plant_nursery'
    || /nurser|नर्सरी/i.test(name)) return 'Plant nursery';
  if (tags.marketplace === 'agricultural'
    || /mandi|agricultural market|farmers'? market|co-?operative|co-?op|कृषि मंडी|मंडी|सहकारी/i.test(name)) {
    return 'Agriculture market or cooperative';
  }
  if (/tractor|farm machinery|agricultural machinery|farm equipment|कृषि यंत्र|ट्रैक्टर/i.test(name)) {
    return 'Farm equipment';
  }
  if (['agrarian', 'seeds'].includes(tags.shop)
    || /seed|fertili[sz]er|pesticide|agrochemical|agri.?input|irrigation|agro.?dealer|बीज|खाद|कीटनाशक|उर्वरक/i.test(name)) {
    return 'Agriculture supplier';
  }
  if (tags.landuse === 'farmyard' || tags.place === 'farm') return 'Farm';
  return 'Agriculture office or company';
}

function normalizeElement(element, origin) {
  if (!element || !element.tags) return null;
  const location = elementLocation(element);
  if (!location) return null;
  const tags = element.tags;
  const category = classify(tags);
  const name = tags.name || tags['name:en'];
  if (!name && !['Plant nursery', 'Farm'].includes(category)) return null;

  const distance = distanceMeters(origin, location);
  if (distance > RADIUS_METERS) return null;

  return {
    id: `${element.type}/${element.id}`,
    name: name || (category === 'Plant nursery' ? 'Unnamed plant nursery' : 'Unnamed farm'),
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

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('That location could not be searched. Please try again.');
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Location search is taking too long. Please try again.');
    if (error.name === 'TypeError') throw new Error('Could not reach location search. Check your internet connection and retry.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
      unique.set(nursery.id, { ...nursery, distanceKm: distance / 1000, address: '' });
    }
  });
  const nearbyDemoLocations = [];
  demoLocations.forEach((location) => {
    const distance = distanceMeters(origin, location.location);
    if (distance <= RADIUS_METERS) {
      nearbyDemoLocations.push({ ...location, distanceKm: distance / 1000, isDemo: true });
    }
  });
  nearbyDemoLocations.sort((a, b) => a.distanceKm - b.distanceKm);
  const nearbyOpenStreetMapPlaces = [...unique.values()]
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, MAX_RESULTS - nearbyDemoLocations.length);
  return [...nearbyOpenStreetMapPlaces, ...nearbyDemoLocations]
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function searchNearbyHelp(origin) {
  const { latitude, longitude } = origin || {};
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('Choose a valid location and try again.');
  }

  const cacheKey = `v7-radius-${RADIUS_METERS}:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cachedElements = getCached(nearbyCache, cacheKey);
  if (cachedElements) return formatPlaces(cachedElements, origin);

  let response;
  try {
    response = await api.nearby(latitude, longitude);
  } catch (error) {
    const fallbackPlaces = formatPlaces([], origin);
    if (fallbackPlaces.length === 0) throw error;
    throw Object.assign(new Error(error.message), { fallbackPlaces });
  }
  const { elements } = response;
  if (!Array.isArray(elements)) throw new Error('Nearby search returned an invalid response. Please retry.');
  setCached(nearbyCache, cacheKey, elements);
  return formatPlaces(elements, origin);
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
    GEOCODER_TIMEOUT_MS,
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
