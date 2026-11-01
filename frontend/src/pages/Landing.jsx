import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Cpu, Layers, Leaf, ListChecks, ScanLine, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Backdrop, Logo, rise, stagger } from '../components/ui.jsx';
import { ErrorBox } from '../components/common.jsx';
import { LanguageSelect, useLanguage } from '../context/LanguageContext.jsx';

function AuthModal({ mode, setMode, onClose }) {
  const { t } = useLanguage();
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await (mode === 'login' ? login(form) : register(form)); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form onSubmit={submit} onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
        className="glass w-full max-w-sm space-y-4 !bg-[#0b2016]/95 p-7">
        <div className="flex items-start justify-between">
          <div><Logo size={22} /><p className="mt-2 text-sm text-emerald-100/60">{t(mode === 'login' ? 'Welcome back' : 'Create your account')}</p></div>
          <button type="button" onClick={onClose} className="opacity-50 hover:opacity-100"><X size={18} /></button>
        </div>
        {mode === 'register' && <div><label className="label">{t('Name')}</label><input className="input" value={form.name} onChange={set('name')} required autoFocus /></div>}
        <div><label className="label">{t('Email')}</label><input type="email" className="input" value={form.email} onChange={set('email')} required autoFocus={mode === 'login'} /></div>
        <div><label className="label">{t('Password')}{mode === 'register' && t(' (min 8 chars)')}</label><input type="password" className="input" value={form.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : 1} /></div>
        <ErrorBox error={error} />
        <button className="btn w-full" disabled={busy}>{busy ? t('Please wait…') : mode === 'login' ? t('Log in') : t('Create account')}</button>
        <button type="button" className="w-full text-center text-sm text-emerald-300 hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {t(mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in')}
        </button>
      </motion.form>
    </motion.div>
  );
}

/** Decorative preview only: cells cycle colours to illustrate the map. Not real data. */
function MapIllustration() {
  const { t } = useLanguage();
  const cells = Array.from({ length: 49 }, (_, i) => i);
  return (
    <div className="glass relative p-5">
      <div className="mb-3 flex items-center justify-between text-xs text-emerald-100/60"><span>{t('Field A · illustration')}</span><span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-300">{t('live map style')}</span></div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.02 }}
            className="aspect-square rounded-md animate-cell-cycle" style={{ animationDelay: `-${((i * 37) % 60) / 10}s`, animationDuration: `${5 + (i % 5)}s` }} />
        ))}
      </div>
      <div className="mt-3 text-[11px] text-emerald-100/40">{t('Decorative preview. Real maps are built from your scans.')}</div>
    </div>
  );
}

const features = [
  [ScanLine, 'Snap and scan', 'Upload a leaf photo from phone or laptop. A MobileNetV3 classifier returns a prediction with a confidence score.'],
  [Layers, 'Field grid map', 'Every scan lands on a grid cell. Colour-coded zones show healthy, stressed, suspected and not-yet-inspected areas.'],
  [ListChecks, 'Targeted next steps', 'Transparent rules turn each result into an inspection step, with human verification clearly flagged.'],
  [ShieldCheck, 'Honest by design', 'Uncertain results are marked uncertain. Uninspected zones are never shown as healthy. No made-up dosages.'],
];

const steps = [['01', 'Create a field', 'Name, crop, acres and a grid.'], ['02', 'Scan zones', 'Upload photos per grid cell.'], ['03', 'Read the map', 'See where attention is needed.'], ['04', 'Inspect smartly', 'Verify flagged zones only.']];

export default function Landing() {
  const { t } = useLanguage();
  const [auth, setAuth] = useState(null);
  return (
    <div className="min-h-screen">
      <Backdrop />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSelect />
          <button className="btn-ghost" onClick={() => setAuth('login')}>{t('Log in')}</button>
          <button className="btn hidden sm:inline-flex" onClick={() => setAuth('register')}>{t('Get started')}</button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-2 lg:pt-16">
        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.span variants={rise} className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Cpu size={14} /> {t('AI-powered precision agriculture')}
          </motion.span>
          <motion.h1 variants={rise} className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            {t('Treat the')} <span className="gradient-text">{t('problem spots')}</span>, {t('not the whole field.')}
          </motion.h1>
          <motion.p variants={rise} className="mt-5 max-w-xl text-lg text-emerald-100/65">
            {t('CropGuard AI analyses crop photos, maps crop health across your field and tells you exactly which zones to inspect first. Less guesswork, less waste.')}
          </motion.p>
          <motion.div variants={rise} className="mt-8 flex flex-wrap gap-3">
            <button className="btn !px-6 !py-3 text-base" onClick={() => setAuth('register')}>{t('Start free')} <ArrowRight size={18} /></button>
            <button className="btn-ghost !px-6 !py-3 text-base" onClick={() => setAuth('login')}>{t('I have an account')}</button>
          </motion.div>
        </motion.div>
        <div className="relative">
          <motion.div className="absolute -left-6 -top-8 hidden text-emerald-300/50 sm:block animate-float" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}><Leaf size={56} /></motion.div>
          <motion.div className="absolute -bottom-8 -right-4 hidden text-lime-300/40 sm:block animate-float [animation-delay:-3s]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}><Leaf size={72} /></motion.div>
          <motion.div initial={{ opacity: 0, y: 40, rotate: 2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.7, delay: 0.2 }}><MapIllustration /></motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(([Icon, title, text]) => (
            <motion.div key={title} variants={rise} className="glass glass-hover p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><Icon size={20} /></span>
              <h3 className="mt-4 font-semibold">{t(title)}</h3>
              <p className="mt-1.5 text-sm text-emerald-100/55">{t(text)}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">{t('How it works')}</h2>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid gap-4 md:grid-cols-4">
          {steps.map(([n, title, description]) => (
            <motion.div key={n} variants={rise} className="glass p-5">
              <div className="text-3xl font-extrabold text-emerald-400/40">{n}</div>
              <div className="mt-2 font-semibold">{t(title)}</div>
              <div className="text-sm text-emerald-100/55">{t(description)}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-xs text-emerald-100/40">
        {t('CropGuard AI is a screening aid, not a diagnosis. Verify flagged zones on-site and follow local agronomic guidance before any treatment.')}
        <div className="mt-4 flex justify-center gap-5">
          <Link to="/about" className="hover:text-emerald-200">{t('About us')}</Link>
          <Link to="/contact" className="hover:text-emerald-200">{t('Contact us')}</Link>
        </div>
      </footer>

      <AnimatePresence>{auth && <AuthModal mode={auth} setMode={setAuth} onClose={() => setAuth(null)} />}</AnimatePresence>
    </div>
  );
}
