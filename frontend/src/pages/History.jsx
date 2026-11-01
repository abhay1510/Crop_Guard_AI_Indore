import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { History as HistoryIcon } from 'lucide-react';
import { api } from '../services/api.js';
import { PageWrap, SectionTitle, Skeleton, rise, stagger } from '../components/ui.jsx';
import { DemoTag, ErrorBox, SecureImage, StatusBadge, nice, pct, when } from '../components/common.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function History() {
  const { t } = useLanguage();
  const [scans, setScans] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.scans().then((r) => setScans(r.scans)).catch((e) => setError(e.message)); }, []);

  return (
    <PageWrap>
      <SectionTitle icon={HistoryIcon} title={t('Scan history')} />
      <ErrorBox error={error} />
      {!scans && !error && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-60" />)}</div>}
      {scans && scans.length === 0 && <div className="glass p-10 text-center text-emerald-100/50">{t('No scans yet.')}</div>}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {scans?.map((s) => (
          <motion.div key={s._id} variants={rise} className="glass glass-hover space-y-2.5 overflow-hidden p-3 text-sm">
            <SecureImage scanId={s._id} className="h-36 w-full rounded-xl" />
            <div className="flex items-center justify-between">
              <span className="font-semibold">{s.fieldId?.name || t('Field')} <span className="text-emerald-300">· {s.zoneId}</span></span>
              {s.status !== 'completed' && <StatusBadge status="unknown" />}
            </div>
            {s.status === 'completed'
              ? <div><b className="capitalize">{t(nice(s.prediction))}</b> <span className="text-emerald-100/55">({pct(s.confidence)}, {t(s.certainty)})</span><DemoTag demo={s.demo} /></div>
              : <div className="text-xs text-rose-300">{t('Analysis')} {t(s.status)}{s.error ? `: ${t(s.error)}` : ''}</div>}
            <div className="text-xs text-emerald-100/40">{when(s.capturedAt)} · model v{s.modelVersion || '–'}</div>
          </motion.div>
        ))}
      </motion.div>
    </PageWrap>
  );
}
