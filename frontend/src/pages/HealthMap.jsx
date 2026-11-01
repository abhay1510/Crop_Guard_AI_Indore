import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Map as MapIcon, Printer } from 'lucide-react';
import { api } from '../services/api.js';
import { CountUp, PageWrap, SectionTitle, Skeleton } from '../components/ui.jsx';
import { DemoTag, ErrorBox, FieldSelect, GridMap, Legend, NoFields, STATUS, SecureImage, StatusBadge, nice, pct, useFields, when } from '../components/common.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function HealthMap() {
  const { t } = useLanguage();
  const { fields, loading, selected, setSelected } = useFields();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [zone, setZone] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!selected) return;
    setData(null); setZone(null); setError('');
    api.healthMap(selected).then(setData).catch((e) => setError(e.message));
  }, [selected]);

  if (loading) return null;
  if (!fields.length) return <PageWrap><NoFields /></PageWrap>;

  const sm = data?.summary;
  const z = zone && data?.zones.find((x) => x.zoneId === zone.zoneId);
  const chips = [['all', t('All')], ...Object.entries(STATUS).map(([k, s]) => [k, t(s.label)])];

  return (
    <PageWrap>
      <SectionTitle icon={MapIcon} title={t('Field health map')}>
        <FieldSelect fields={fields} selected={selected} setSelected={setSelected} />
        <Link to="/report" className="btn-ghost"><Printer size={15} />{t('Report')}</Link>
      </SectionTitle>
      <ErrorBox error={error} />
      {!data && !error && <Skeleton className="h-96" />}
      {data && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {chips.map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${filter === k ? 'border-emerald-300 bg-emerald-400 text-emerald-950' : 'border-white/10 bg-white/5 text-emerald-100/70 hover:bg-white/10'}`}>{label}</button>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="glass space-y-5 p-5 lg:col-span-2">
              <Legend />
              <GridMap zones={data.zones} cols={data.field.gridColumns} onSelect={setZone} selectedId={z?.zoneId} filter={filter} />
              <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm sm:grid-cols-4">
                <div><div className="text-2xl font-extrabold"><CountUp value={sm.inspectedZones} /><span className="text-base text-emerald-100/40">/{sm.totalZones}</span></div><div className="text-xs text-emerald-100/50">{t('zones inspected')}</div></div>
                <div><div className="text-2xl font-extrabold text-amber-300"><CountUp value={sm.flaggedZones} /></div><div className="text-xs text-emerald-100/50">{t('zones flagged')}</div></div>
                <div><div className="text-2xl font-extrabold text-sky-300"><CountUp value={sm.flaggedAreaAcres} decimals={2} /> ac</div><div className="text-xs text-emerald-100/50">{t('flagged area')}</div></div>
                <div><div className="text-2xl font-extrabold"><CountUp value={sm.areaPerCellAcres} decimals={3} /> ac</div><div className="text-xs text-emerald-100/50">{t('per zone')}</div></div>
              </div>
              <p className="text-[11px] text-emerald-100/35">{t(sm.note)} {t('Uninspected zones are never shown as healthy. Zones are grid cells, not GPS positions.')}</p>
            </div>

            <div className="glass h-fit p-5">
              <h2 className="mb-3 font-semibold">{z ? `${t('Zone')} ${z.zoneId}` : t('Zone details')}</h2>
              <AnimatePresence mode="wait">
                {!z ? <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center text-sm text-emerald-100/40">{t('Select a zone on the map.')}</motion.p> : (
                  <motion.div key={z.zoneId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3 text-sm">
                    <StatusBadge status={z.status} />
                    {z.conflict && <div className="rounded-lg bg-orange-500/10 px-3 py-2 text-xs text-orange-300">{t('Latest scan conflicts with the previous one. Please review.')}</div>}
                    {z.latestScan ? (
                      <>
                        <SecureImage scanId={z.latestScan.id} className="h-44 w-full rounded-xl" />
                        <div><b className="capitalize">{t(nice(z.latestScan.prediction))}</b> <span className="text-emerald-100/60">({pct(z.latestScan.confidence)}, {t(z.latestScan.certainty)})</span><DemoTag demo={z.latestScan.demo} /></div>
                        <div className="text-xs text-emerald-100/45">{t('Last scan')} {when(z.latestScan.capturedAt)} · {z.scanCount} {t('scan(s) in zone')}</div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">{t(z.recommendation.action)}</div>
                      </>
                    ) : <p className="text-emerald-100/50">{t('No scans for this zone yet. Use the Scanner to add one.')}</p>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </>
      )}
    </PageWrap>
  );
}
