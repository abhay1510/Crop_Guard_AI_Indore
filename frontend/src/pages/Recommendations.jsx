import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ListChecks, ShieldAlert } from 'lucide-react';
import { api } from '../services/api.js';
import { PageWrap, SectionTitle, Skeleton, rise, stagger } from '../components/ui.jsx';
import { ErrorBox, FieldSelect, NoFields, StatusBadge, nice, pct, useFields, when } from '../components/common.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const sev = { high: 'text-rose-300 bg-rose-500/15', medium: 'text-amber-300 bg-amber-400/15', low: 'text-slate-300 bg-slate-400/15', none: 'text-emerald-300 bg-emerald-400/15' };

export default function Recommendations() {
  const { t } = useLanguage();
  const { fields, loading, selected, setSelected } = useFields();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selected) return;
    setItems(null); setError('');
    api.recommendations(selected).then((r) => setItems(r.recommendations)).catch((e) => setError(e.message));
  }, [selected]);

  if (loading) return null;
  if (!fields.length) return <PageWrap><NoFields /></PageWrap>;

  return (
    <PageWrap>
      <SectionTitle icon={ListChecks} title={t('Recommended actions')}>
        <FieldSelect fields={fields} selected={selected} setSelected={setSelected} />
      </SectionTitle>
      <ErrorBox error={error} />
      {!items && !error && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>}
      {items && items.length === 0 && <div className="glass p-10 text-center text-emerald-100/50">{t('No zones need attention, or no zones have been scanned yet.')}</div>}
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
        {items?.map((r) => (
          <motion.div key={r.zoneId} variants={rise} className="glass glass-hover flex flex-wrap items-start gap-4 p-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/5 text-lg font-extrabold">{r.zoneId}</div>
            <div className="min-w-[14rem] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={r.status} />
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${sev[r.severity]}`}>{t(r.severity)} {t('priority')}</span>
                {r.conflict && <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 text-xs text-orange-300">{t('conflicting scans')}</span>}
              </div>
              <div className="mt-2 text-sm">{t(r.action)}</div>
              <div className="mt-1.5 text-xs text-emerald-100/40"><span className="capitalize">{t(nice(r.condition))}</span> · {pct(r.confidence)} · {when(r.capturedAt)}</div>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {r.requiresVerification ? <span className="flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-3 py-1.5 font-medium text-amber-300"><ShieldAlert size={14} />{t('Verify on-site')}</span> : <span className="text-emerald-100/40">{t('No verification needed')}</span>}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </PageWrap>
  );
}
