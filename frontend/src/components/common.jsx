import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, fetchImageBlobUrl } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';

export const STATUS = {
  healthy: { label: 'Healthy', cell: 'bg-emerald-400/90 text-emerald-950', badge: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30', color: '#34d399' },
  possible_stress: { label: 'Possible stress', cell: 'bg-amber-400/90 text-amber-950', badge: 'bg-amber-400/15 text-amber-300 border-amber-400/30', color: '#fbbf24' },
  suspected_disease: { label: 'Suspected disease', cell: 'bg-rose-500/90 text-white animate-pulse-ring', badge: 'bg-rose-500/15 text-rose-300 border-rose-400/30', color: '#f43f5e' },
  unknown: { label: 'Unknown / uncertain', cell: 'bg-slate-400/70 text-slate-950', badge: 'bg-slate-400/15 text-slate-300 border-slate-400/30', color: '#94a3b8' },
  not_inspected: { label: 'Not inspected', cell: 'bg-white/[0.04] border border-dashed border-white/20 text-white/40', badge: 'bg-white/5 text-white/50 border-white/15', color: '#334155' },
};

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.unknown;
  const { t } = useLanguage();
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.badge}`}>{t(s.label)}</span>;
}

export function DemoTag({ demo }) {
  const { t } = useLanguage();
  return demo ? <span className="ml-2 rounded-md border border-violet-400/30 bg-violet-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">{t('Demo / simulated')}</span> : null;
}

export function ErrorBox({ error }) {
  const { t } = useLanguage();
  return error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200">{t(error)}</div> : null;
}

export const pct = (n) => (typeof n === 'number' ? `${(n * 100).toFixed(1)}%` : '–');
export const when = (d) => (d ? new Date(d).toLocaleString() : '–');
export const nice = (s) => (s ? String(s).replace(/___/g, ' · ').replace(/_/g, ' ') : '–');

export function SecureImage({ scanId, className = '' }) {
  const { t } = useLanguage();
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url; let dead = false;
    setSrc(null);
    fetchImageBlobUrl(scanId).then((u) => { if (dead) URL.revokeObjectURL(u); else { url = u; setSrc(u); } }).catch(() => {});
    return () => { dead = true; if (url) URL.revokeObjectURL(url); };
  }, [scanId]);
  if (!src) return <div className={`grid place-items-center bg-white/5 text-[11px] text-white/30 ${className}`}>{t('no image')}</div>;
  return <img src={src} alt="crop scan" className={`object-cover ${className}`} />;
}

/** Loads the user's fields and tracks the selected one (persisted across pages). */
export function useFields() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelectedState] = useState(localStorage.getItem('cg_field') || '');

  const setSelected = (id) => { setSelectedState(id); localStorage.setItem('cg_field', id); };
  const reload = () => api.fields().then((r) => {
    setFields(r.fields);
    if (!r.fields.find((f) => f._id === selected)) setSelected(r.fields[0]?._id || '');
  }).catch((e) => setError(e.message)).finally(() => setLoading(false));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, []);
  return { fields, loading, error, selected, setSelected, reload, field: fields.find((f) => f._id === selected) };
}

export function FieldSelect({ fields, selected, setSelected }) {
  const { t } = useLanguage();
  return (
    <select className="input !w-auto min-w-[12rem]" value={selected} onChange={(e) => setSelected(e.target.value)}>
      {fields.map((f) => <option key={f._id} value={f._id}>{f.name} ({t(f.cropType)})</option>)}
    </select>
  );
}

export function GridMap({ zones, cols, onSelect, selectedId, filter, imagePreview, imageZoneId }) {
  const { t } = useLanguage();
  return (
    <div className="max-w-full overflow-x-auto pb-2">
      <div className="inline-grid gap-1.5 p-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(2.4rem, 3rem))` }}>
        {zones.map((z, i) => {
          const dim = filter && filter !== 'all' && z.status !== filter;
          return (
            <motion.button key={z.zoneId} onClick={() => onSelect && onSelect(z)} title={`${z.zoneId}: ${t(STATUS[z.status].label)}`}
              initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: dim ? 0.18 : 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.012, 0.8), type: 'spring', stiffness: 260, damping: 18 }}
              whileHover={{ scale: 1.18, zIndex: 5 }} whileTap={{ scale: 0.92 }}
              className={`relative aspect-square rounded-lg text-[10px] font-bold ${STATUS[z.status].cell} ${selectedId === z.zoneId ? 'ring-2 ring-white ring-offset-2 ring-offset-[#06140d]' : ''}`}>
              {imagePreview && imageZoneId === z.zoneId && (
                <>
                  <img src={imagePreview} alt="" className="absolute inset-0 h-full w-full rounded-lg object-cover" />
                  <span className="absolute inset-0 rounded-lg bg-black/35" />
                </>
              )}
              <span className="relative z-10">{z.zoneId}</span>
              {z.conflict && <span className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-orange-500 text-[9px] leading-none text-white">!</span>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function Legend() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-emerald-100/70">
      {Object.entries(STATUS).map(([k, s]) => (
        <span key={k} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: s.color, opacity: k === 'not_inspected' ? 0.6 : 1 }} />{t(s.label)}</span>
      ))}
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-orange-500" />{t('conflicting scans')}</span>
    </div>
  );
}

export function NoFields() {
  const { t } = useLanguage();
  return (
    <div className="glass p-8 text-center">
      <p className="text-emerald-100/70">{t('No fields yet. Create one first.')}</p>
      <Link to="/fields" className="btn mt-4">{t('Go to Fields')}</Link>
    </div>
  );
}