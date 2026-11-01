import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, animate, motion } from 'framer-motion';
import { CheckCircle2, Info, Leaf, TriangleAlert, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

export function Logo({ size = 28 }) {
  return (
    <span className="inline-flex items-center gap-2 font-extrabold tracking-tight">
      <span className="grid place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-lime-400 text-emerald-950 shadow-lg shadow-emerald-500/30" style={{ width: size + 8, height: size + 8 }}>
        <Leaf size={size - 6} strokeWidth={2.5} />
      </span>
      <span>CropGuard <span className="text-emerald-300">AI</span></span>
    </span>
  );
}

/** Animated background: drifting blurred blobs + faint grid. Purely decorative. */
export function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
      <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-emerald-500/20 blur-[110px] animate-blob" />
      <div className="absolute right-[-8rem] top-1/3 h-[26rem] w-[26rem] rounded-full bg-lime-400/10 blur-[120px] animate-blob [animation-delay:-6s]" />
      <div className="absolute bottom-[-10rem] left-1/3 h-[30rem] w-[30rem] rounded-full bg-teal-500/15 blur-[120px] animate-blob [animation-delay:-12s]" />
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)' }} />
    </div>
  );
}

export function CountUp({ value = 0, decimals = 0, duration = 1.1 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, Number(value) || 0, { duration, ease: 'easeOut', onUpdate: setV });
    return () => c.stop();
  }, [value, duration]);
  return <>{v.toFixed(decimals)}</>;
}

export function PageWrap({ children, className = '' }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}

export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
export const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } };

export function Skeleton({ className = '' }) {
  return <div className={`relative overflow-hidden rounded-xl bg-white/5 ${className}`}><div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" /></div>;
}

/** Circular confidence gauge. Shows the model score, which is not a guaranteed probability. */
export function ConfidenceRing({ value = 0, size = 110, color = '#34d399' }) {
  const { t } = useLanguage();
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth="9" fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="9" fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }} transition={{ duration: 1.2, ease: 'easeOut' }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-bold"><CountUp value={value * 100} decimals={0} />%</div>
        <div className="text-[10px] uppercase tracking-wider text-emerald-100/50">{t('score')}</div>
      </div>
    </div>
  );
}

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, message, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
  }, []);
  const icon = { info: <Info size={18} className="text-sky-300" />, success: <CheckCircle2 size={18} className="text-emerald-300" />, error: <TriangleAlert size={18} className="text-rose-300" /> };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 print:hidden">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, x: 60, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60 }}
              className="glass flex items-start gap-3 !bg-[#0b2016]/90 px-4 py-3 text-sm">
              {icon[t.kind]}<span className="flex-1">{t.message}</span>
              <button onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} className="opacity-50 hover:opacity-100"><X size={14} /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function SectionTitle({ icon: Icon, title, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      {Icon && <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><Icon size={18} /></span>}
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
