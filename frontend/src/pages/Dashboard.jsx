import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, HandHelping, LayoutDashboard, Layers, ScanLine, Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { CountUp, PageWrap, Skeleton, SectionTitle, rise, stagger } from '../components/ui.jsx';
import { DemoTag, ErrorBox, STATUS, StatusBadge, nice, pct, when } from '../components/common.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

function Stat({ icon: Icon, label, value, decimals = 0, suffix = '', sub, tone = 'text-emerald-300' }) {
  return (
    <motion.div variants={rise} className="glass glass-hover p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-emerald-100/50">{label}</span>
        <Icon size={18} className={tone} />
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight"><CountUp value={value} decimals={decimals} />{suffix}</div>
      {sub && <div className="mt-1 text-xs text-emerald-100/40">{sub}</div>}
    </motion.div>
  );
}

const tip = { background: '#0b2016', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#ecfdf5', fontSize: 12 };

export default function Dashboard() {
  const { t } = useLanguage();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [ai, setAi] = useState(null);

  useEffect(() => {
    api.dashboard().then(setD).catch((e) => setError(e.message));
    api.health().then((h) => setAi(h.ai)).catch(() => setAi({ status: 'down' }));
  }, []);

  const aiLabel = t(!ai ? 'checking…' : ai.status !== 'ok' ? 'offline' : ai.mode === 'real' ? 'trained model online' : 'no trained model loaded');
  const aiColor = !ai ? 'bg-slate-400' : ai.status !== 'ok' ? 'bg-rose-400' : ai.mode === 'real' ? 'bg-emerald-400' : 'bg-amber-400';

  return (
    <PageWrap>
      <SectionTitle icon={LayoutDashboard} title={t('Dashboard')}>
        <span className="glass flex items-center gap-2 !rounded-full px-3 py-1.5 text-xs">
          <span className="relative flex h-2.5 w-2.5"><span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${aiColor}`} /><span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${aiColor}`} /></span>
          {t('AI service:')} {aiLabel}
        </span>
      </SectionTitle>
      <ErrorBox error={error} />
      {!d && !error && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>}
      {d && (() => {
        const c = d.zoneCounts;
        const flagged = c.possible_stress + c.suspected_disease;
        const chart = Object.keys(STATUS).map((k) => ({ key: k, name: t(STATUS[k].label), value: c[k] }));
        const hasZones = chart.some((x) => x.value > 0);
        return (
          <>
            <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Stat icon={Sprout} label={t('Fields')} value={d.totalFields} />
              <Stat icon={ScanLine} label={t('Total scans')} value={d.totalScans} />
              <Stat icon={CheckCircle2} label={t('Healthy zones')} value={c.healthy} />
              <Stat icon={AlertTriangle} label={t('Zones to inspect')} value={flagged} tone="text-amber-300" sub={`${c.suspected_disease} ${t('suspected disease')}`} />
              <Stat icon={Layers} label={t('Flagged area')} value={d.flaggedAreaAcres} decimals={2} suffix=" ac" tone="text-sky-300" sub={t('for inspection, not treatment')} />
            </motion.div>

            <div className="mt-6 grid gap-6 lg:grid-cols-5">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass p-5 lg:col-span-3">
                <h2 className="mb-4 font-semibold">{t('Crop-health distribution (zones)')}</h2>
                {!hasZones ? <p className="py-16 text-center text-sm text-emerald-100/40">{t('No zones yet. Create a field to begin.')}</p> : (
                  <div className="h-64">
                    <ResponsiveContainer>
                      <BarChart data={chart} margin={{ left: -20 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#a7f3d0aa' }} interval={0} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#a7f3d0aa' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tip} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={1200}>{chart.map((e) => <Cell key={e.key} fill={STATUS[e.key].color} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass p-5 lg:col-span-2">
                <h2 className="mb-2 font-semibold">{t('Inspected vs not inspected')}</h2>
                {!hasZones ? <p className="py-16 text-center text-sm text-emerald-100/40">{t('Nothing to show yet.')}</p> : (
                  <div className="h-64">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={chart.filter((x) => x.value > 0)} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={3} animationDuration={1200} stroke="none">
                          {chart.filter((x) => x.value > 0).map((e) => <Cell key={e.key} fill={STATUS[e.key].color} />)}
                        </Pie>
                        <Tooltip contentStyle={tip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </motion.div>
            </div>

            <Link to="/nearby-help" className="glass glass-hover mt-6 flex flex-wrap items-center gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><HandHelping size={21} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t('Find agricultural help nearby')}</span>
                <span className="mt-1 block text-sm text-emerald-100/55">{t('Find all agriculture-related places within 80 km.')}</span>
              </span>
              <span className="flex items-center gap-2 text-sm font-medium text-emerald-300">{t('Nearby help')}<ArrowRight size={16} /></span>
            </Link>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass mt-6 p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><Activity size={16} className="text-emerald-300" />{t('Recent scans')}</h2>
              {d.recentScans.length === 0 && <p className="py-6 text-center text-sm text-emerald-100/40">{t('No scans yet. Upload one on the Scanner page.')}</p>}
              <motion.ul variants={stagger} initial="hidden" animate="show" className="divide-y divide-white/5 text-sm">
                {d.recentScans.map((s) => (
                  <motion.li variants={rise} key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div><div className="font-medium">{s.fieldName || t('Field')} <span className="text-emerald-300">· {t('zone')} {s.zoneId}</span></div><div className="text-xs text-emerald-100/40">{when(s.capturedAt)}</div></div>
                    <div className="text-right">
                      {s.status === 'completed' ? <div className="capitalize">{t(nice(s.prediction))} <span className="text-emerald-100/50">({pct(s.confidence)})</span></div> : <StatusBadge status="unknown" />}
                      <DemoTag demo={s.demo} />
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>
          </>
        );
      })()}
    </PageWrap>
  );
}