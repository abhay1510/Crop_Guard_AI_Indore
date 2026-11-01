import { useEffect, useState } from 'react';
import { Activity, Printer } from 'lucide-react';
import { api } from '../services/api.js';
import { PageWrap, SectionTitle, Skeleton } from '../components/ui.jsx';
import { ErrorBox, FieldSelect, NoFields, STATUS, nice, pct, useFields, when } from '../components/common.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Report() {
  const { t } = useLanguage();
  const { fields, loading, selected, setSelected } = useFields();
  const [r, setR] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selected) return;
    setR(null); setError('');
    api.report(selected).then(setR).catch((e) => setError(e.message));
  }, [selected]);

  if (loading) return null;
  if (!fields.length) return <PageWrap><NoFields /></PageWrap>;

  return (
    <PageWrap>
      <div className="print:hidden">
        <SectionTitle icon={Activity} title={t('Field report')}>
          <FieldSelect fields={fields} selected={selected} setSelected={setSelected} />
          <button className="btn" onClick={() => window.print()} disabled={!r}><Printer size={16} />{t('Print / Save PDF')}</button>
        </SectionTitle>
      </div>
      <ErrorBox error={error} />
      {!r && !error && <Skeleton className="h-96" />}
      {r && (
        <article className="mx-auto max-w-4xl rounded-2xl bg-white p-8 text-stone-800 shadow-2xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
          <header className="border-b border-stone-200 pb-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700">CropGuard AI · {t('Field report')}</div>
            <h2 className="mt-1 text-2xl font-extrabold">{r.field.name}</h2>
            <div className="text-sm text-stone-500">{t(nice(r.field.cropType))} · {r.field.areaAcres} {t('acres')} · {r.field.gridRows}×{r.field.gridColumns} {t('grid')} · {t('generated')} {when(r.generatedAt)}</div>
          </header>

          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Scans', r.summary.totalScans], ['Zones inspected', `${r.summary.inspectedZones}/${r.summary.totalZones}`], ['Zones flagged', r.summary.flaggedZones], ['Flagged area', `${r.summary.flaggedAreaAcres} ac`]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-stone-100 p-3"><div className="text-xl font-extrabold">{v}</div><div className="text-xs text-stone-500">{t(k)}</div></div>
            ))}
          </section>

          <section className="mt-6">
            <h3 className="mb-2 font-bold">{t('Zone map')}</h3>
            <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${r.field.gridColumns}, 2.2rem)` }}>
              {r.zones.map((z) => (
                <div key={z.zoneId} className="grid aspect-square place-items-center rounded text-[9px] font-bold text-stone-900/70" style={{ background: z.status === 'not_inspected' ? '#e7e5e4' : STATUS[z.status].color, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{z.zoneId}</div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-600">
              {Object.entries(STATUS).map(([k, s]) => <span key={k} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: k === 'not_inspected' ? '#e7e5e4' : s.color, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />{t(s.label)} ({r.summary.counts[k]})</span>)}
            </div>
          </section>

          <section className="mt-6">
            <h3 className="mb-2 font-bold">{t('Zones needing attention')}</h3>
            {r.actions.length === 0 ? <p className="text-sm text-stone-500">{t('None. No flagged zones.')}</p> : (
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-stone-300 text-xs uppercase text-stone-500"><th className="py-2">{t('Zone')}</th><th>{t('Status')}</th><th>{t('Condition')}</th><th>{t('Next step')}</th></tr></thead>
                <tbody>
                  {r.actions.map((a) => (
                    <tr key={a.zoneId} className="border-b border-stone-100 align-top">
                      <td className="py-2 font-semibold">{a.zoneId}</td>
                      <td>{t(STATUS[a.status].label)}</td>
                      <td className="capitalize">{t(nice(a.condition))}<div className="text-xs text-stone-400">{pct(a.confidence)}</div></td>
                      <td className="pr-2">{t(a.action)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <footer className="mt-8 border-t border-stone-200 pt-3 text-xs text-stone-500">{t(r.summary.note)} {t(r.disclaimer)}</footer>
        </article>
      )}
    </PageWrap>
  );
}