import { useRef, useState } from 'react';
import { ExternalLink, HandHelping, LocateFixed, MapPin, Search } from 'lucide-react';
import { PageWrap, SectionTitle } from '../components/ui.jsx';
import { ErrorBox } from '../components/common.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { findPlace, searchNearbyHelp } from '../services/nearbyHelp.js';

const formatDistance = (distance) => distance < 1
  ? `${Math.round(distance * 1000)} m`
  : `${distance.toFixed(1)} km`;

export default function NearbyHelp() {
  const { t } = useLanguage();
  const [place, setPlace] = useState(null);
  const [places, setPlaces] = useState([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const requestId = useRef(0);

  const loadNearby = async (location, label) => {
    const currentRequest = ++requestId.current;
    setBusy(true);
    setError('');
    setPlace({ ...location, label });
    setPlaces([]);
    setSearched(false);
    try {
      const results = await searchNearbyHelp(location);
      if (requestId.current !== currentRequest) return;
      setPlaces(results);
      setSearched(true);
    } catch (e) {
      if (requestId.current === currentRequest) {
        setError(e.message);
        if (Array.isArray(e.fallbackPlaces)) {
          setPlaces(e.fallbackPlaces);
          setSearched(true);
        }
      }
    } finally {
      if (requestId.current === currentRequest) setBusy(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError(t('Location is not supported by this browser. Search for a town instead.'));
      return;
    }
    const currentRequest = ++requestId.current;
    setBusy(true);
    setError('');
    setSearched(false);
    setPlaces([]);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (requestId.current !== currentRequest) return;
        loadNearby({ latitude: coords.latitude, longitude: coords.longitude }, t('Your current location'));
      },
      (geoError) => {
        if (requestId.current !== currentRequest) return;
        setBusy(false);
        setError(geoError.code === 1
          ? t('Location permission was denied. Search for a town instead.')
          : t('Could not get your location. Check your device settings or search for a town.'));
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000 },
    );
  };

  const searchTown = async (event) => {
    event.preventDefault();
    const currentRequest = ++requestId.current;
    setBusy(true);
    setError('');
    setSearched(false);
    setPlaces([]);
    try {
      const result = await findPlace(query);
      if (requestId.current !== currentRequest) return;
      await loadNearby(result, result.label);
    } catch (e) {
      if (requestId.current === currentRequest) {
        setBusy(false);
        setError(t(e.message));
      }
    }
  };

  return (
    <PageWrap>
      <SectionTitle icon={HandHelping} title={t('Nearby agricultural help')} />
      <p className="mb-5 max-w-3xl text-sm leading-6 text-emerald-100/65">
        {t('Find agricultural offices, advisory centres, nurseries, suppliers, farm equipment, markets, cooperatives, farms and veterinary services within 50 km.')}
      </p>

      <section className="glass mb-6 p-5" aria-label={t('Choose a search location')}>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn" onClick={useMyLocation} disabled={busy}>
            <LocateFixed size={17} />{busy ? t('Searching…') : t('Use my location')}
          </button>
          <span className="self-center text-xs text-emerald-100/40">{t('Your location is sent to OpenStreetMap services for this search and is not saved by CropGuard.')}</span>
        </div>
        <form onSubmit={searchTown} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="nearby-place">{t('Village, town or district')}</label>
          <input
            id="nearby-place"
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Village, town or district')}
            autoComplete="address-level2"
          />
          <button className="btn-ghost shrink-0" type="submit" disabled={busy}><Search size={16} />{t('Search area')}</button>
        </form>
      </section>

      {error && (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <div className="min-w-[16rem] flex-1"><ErrorBox error={error} /></div>
          {place && <button className="btn-ghost shrink-0" type="button" disabled={busy} onClick={() => loadNearby(place, place.label)}>{t('Retry search')}</button>}
        </div>
      )}

      {busy && (
        <div className="py-8 text-center text-sm text-emerald-100/55" role="status">
          <p>{t('Finding services within 50 km…')}</p>
        </div>
      )}

      {!busy && searched && (
        <section aria-live="polite">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">{t('Results near')} {place?.label}</h2>
            <span className="text-xs text-emerald-100/45">{places.length} {t('locations shown (maximum 10)')}</span>
          </div>
          {places.length === 0 ? (
            <div className="glass p-7 text-center text-sm text-emerald-100/55">
              <p>{t('No matching services were found within 50 km. Some businesses may not be listed on OpenStreetMap.')}</p>
              {place && (
                <a
                  className="btn-ghost mt-4"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`plant nurseries near ${place.latitude},${place.longitude}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={15} />{t('Search plant nurseries on Google Maps (results may be outside 50 km)')}
                </a>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {places.map((item) => (
                <article key={item.id} className="glass glass-hover flex flex-col p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300"><MapPin size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold leading-snug">{t(item.name)}</h3>
                      <p className="mt-1 text-xs text-emerald-200/65">{t(item.category)} · {formatDistance(item.distanceKm)}</p>
                      {item.isDemo && <p className="mt-1 text-xs font-medium text-amber-200">{t('Hackathon demo point · not a verified business')}</p>}
                    </div>
                  </div>
                  {item.address && <p className="mt-3 text-sm text-emerald-100/65">{item.address}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      className="btn-ghost !px-3 !py-2 text-xs"
                      href={`https://www.google.com/maps/search/?api=1&query=${item.location.latitude},${item.location.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin size={14} />{t('View location')}
                    </a>
                    {item.mapUrl && <a className="btn-ghost !px-3 !py-2 text-xs" href={item.mapUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />{t('View Google Maps listing')}</a>}
                    <a
                      className="btn-ghost !px-3 !py-2 text-xs"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${item.location.latitude},${item.location.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin size={14} />{t('Directions')}
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {!busy && !searched && !error && (
        <div className="glass flex items-start gap-3 p-5 text-sm text-emerald-100/55">
          <MapPin size={18} className="mt-0.5 shrink-0 text-emerald-300" />
          <p>{t('Choose your current location or search for a town to see nearby agriculture support.')}</p>
        </div>
      )}

      <p className="mt-6 text-xs leading-5 text-emerald-100/35">
        {t('Locations include OpenStreetMap results and farmer-shared listings; hackathon demo points are samples, not verified businesses.')}
        {' '}<a className="underline underline-offset-2 hover:text-emerald-100/65" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
      </p>
    </PageWrap>
  );
}
