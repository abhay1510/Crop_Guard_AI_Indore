import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, History as HistoryIcon, LayoutDashboard, ListChecks, LogOut, Map as MapIcon, MessageCircle, Mic, ScanLine, Sprout, HandHelping, Info, Mail, ShieldCheck, Languages } from 'lucide-react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { useLanguage } from './context/LanguageContext.jsx';
import { LanguageSelect } from './context/LanguageContext.jsx';
import { Backdrop, Logo } from './components/ui.jsx';
import Landing from './pages/Landing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Fields from './pages/Fields.jsx';
import Scanner from './pages/Scanner.jsx';
import HealthMap from './pages/HealthMap.jsx';
import Recommendations from './pages/Recommendations.jsx';
import History from './pages/History.jsx';
import Report from './pages/Report.jsx';
import FarmChat from './pages/FarmChat.jsx';
import NearbyHelp from './pages/NearbyHelp.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import PublicPage from './pages/PublicPage.jsx';

const primaryLinks = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/fields', 'Fields', Sprout],
  ['/scan', 'Scanner', ScanLine],
];

const secondaryLinks = [
  ['/map', 'Health Map', MapIcon],
  ['/nearby-help', 'Nearby help', HandHelping],
  ['/recommendations', 'Actions', ListChecks],
  ['/history', 'History', HistoryIcon],
  ['/report', 'Report', Activity],
  ['/farm-assistant', 'Farm assistant', MessageCircle],
];

const TOUR_STEPS = [
  {
    path: '/',
    target: 'language-selector',
    title: 'Choose your language',
    description: 'Use the language menu in the top-right corner to switch between English, Hindi, and Marathi. Your choice is saved on this browser.',
  },
  {
    path: '/',
    target: 'dashboard-menu',
    title: 'Dashboard',
    description: 'The Dashboard gives you a quick overview of your fields, scans, crop-health zones, and recent activity.',
  },
  {
    path: '/fields',
    target: 'fields-menu',
    title: 'Fields',
    description: 'Open Fields to add a farm field with its crop, area, and grid size. Use each field’s Scan or Map button to continue.',
  },
  {
    path: '/scan',
    target: 'scanner-menu',
    title: 'Scanner',
    description: 'Open Scanner to select a field and upload a close-up leaf photo or a drone image for crop-health screening.',
  },
  {
    path: '/map',
    target: 'map-menu',
    title: 'Health Map',
    description: 'Open Health Map to view scan results by field zone and see which areas may need an on-site inspection.',
  },
  {
    path: '/nearby-help',
    target: 'nearby-help-menu',
    title: 'Nearby help',
    description: 'Find agriculture-related offices, nurseries, suppliers, and other places. Use your location or search for a town.',
  },
  {
    path: '/recommendations',
    target: 'actions-menu',
    title: 'Actions',
    description: 'Open Actions to review inspection suggestions based on your scan results. Treat AI findings as guidance, not a confirmed diagnosis.',
  },
  {
    path: '/history',
    target: 'history-menu',
    title: 'History',
    description: 'Open History to review previous scans and compare results over time.',
  },
  {
    path: '/report',
    target: 'report-menu',
    title: 'Report',
    description: 'Open Report to view or print a summary of your field and crop-health information.',
  },
  {
    path: '/farm-assistant',
    target: 'assistant-menu',
    title: 'Farm assistant',
    description: 'Open Farm assistant to ask farming-related questions. You can also use the floating microphone button to start voice input.',
  },
];

function Layout({ children }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isAdmin = user.role === 'admin';
  const guideKey = `cg_app_tour_seen_v2_${user.id || user.email}`;
  const [showAppTour, setShowAppTour] = useState(() => !isAdmin && !localStorage.getItem(guideKey));
  const [tourStep, setTourStep] = useState(0);
  const activeTourStep = TOUR_STEPS[tourStep];
  const dismissTour = () => {
    localStorage.setItem(guideKey, 'true');
    setShowAppTour(false);
  };
  const advanceTour = () => {
    if (tourStep === TOUR_STEPS.length - 1) {
      dismissTour();
      return;
    }
    setTourStep((step) => step + 1);
  };
  const retreatTour = () => setTourStep((step) => Math.max(0, step - 1));
  const tourHighlight = (target) => showAppTour && activeTourStep.target === target
    ? 'relative z-[91] ring-2 ring-lime-300 shadow-[0_0_20px_rgba(190,242,100,0.65)]'
    : '';
  useEffect(() => {
    if (showAppTour && pathname !== activeTourStep.path) {
      navigate(activeTourStep.path);
    }
  }, [activeTourStep.path, navigate, pathname, showAppTour]);
  const links = [
    ...(isAdmin
      ? [['/admin', 'Admin', ShieldCheck]]
      : [...secondaryLinks, ['/about', 'About us', Info], ['/contact', 'Contact us', Mail]]),
  ];
  const isActive = (to) => to === '/' ? pathname === '/' : pathname.startsWith(to);
  return (
    <div className="min-h-screen">
      <Backdrop />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#06140d]/70 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Logo size={24} />
          {!isAdmin && (
            <nav aria-label="Main sections" className="ml-2 hidden items-center gap-1 text-sm lg:flex">
              {primaryLinks.map(([to, label, Icon]) => (
                <NavLink key={to} to={to} end={to === '/'} className={`relative flex items-center gap-2 rounded-lg px-3 py-2 transition ${isActive(to) ? 'text-emerald-950' : 'text-emerald-100/70 hover:bg-white/5 hover:text-white'} ${tourHighlight(to === '/' ? 'dashboard-menu' : to === '/fields' ? 'fields-menu' : 'scanner-menu')}`}>
                  {isActive(to) && <motion.span layoutId="primary-nav-pill" className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-400 to-lime-400" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                  <span className="relative z-10 flex items-center gap-2 font-medium"><Icon size={16} />{t(label)}</span>
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-3 text-sm">
            <LanguageSelect className={tourHighlight('language-selector')} />
            <span className="hidden text-emerald-100/60 sm:inline">{user.name}</span>
            <button onClick={logout} className="btn-ghost !px-3" title={t('Log out')}><LogOut size={16} /><span className="hidden sm:inline">{t('Log out')}</span></button>
          </div>
        </div>
        {!isAdmin && (
          <nav aria-label="Main sections" className="flex gap-1 overflow-x-auto border-t border-white/5 px-3 py-2 text-xs lg:hidden">
            {primaryLinks.map(([to, label, Icon]) => (
              <NavLink key={to} to={to} end={to === '/'} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 ${isActive(to) ? 'bg-emerald-400 text-emerald-950' : 'bg-white/5 text-emerald-100/70'} ${tourHighlight(to === '/' ? 'dashboard-menu' : to === '/fields' ? 'fields-menu' : 'scanner-menu')}`}>
                <Icon size={14} />{t(label)}
              </NavLink>
            ))}
          </nav>
        )}
        <nav aria-label={isAdmin ? t('Admin navigation') : t('More sections')} className="mx-auto flex max-w-7xl gap-1 overflow-x-auto border-t border-white/10 bg-black/10 px-4 py-1.5 text-xs">
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 transition ${isActive(to) ? 'bg-emerald-400/15 text-emerald-200' : 'text-emerald-100/45 hover:bg-white/5 hover:text-emerald-100/80'} ${tourHighlight(({ '/map': 'map-menu', '/nearby-help': 'nearby-help-menu', '/recommendations': 'actions-menu', '/history': 'history-menu', '/report': 'report-menu', '/farm-assistant': 'assistant-menu' })[to])}`}>
              <Icon size={14} />{t(label)}
            </NavLink>
          ))}
        </nav>
      </header>
      <AnimatePresence>
        {showAppTour && (
          <motion.div
            className="fixed inset-0 z-[90] grid place-items-center bg-black/55 p-4 backdrop-blur-sm print:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="language-guide-title"
              className="glass w-full max-w-lg border border-emerald-300/20 p-6 shadow-2xl"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><Languages size={20} /></span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">{t('App tour')} · {tourStep + 1} {t('of')} {TOUR_STEPS.length}</p>
                  <h2 id="language-guide-title" className="mt-1 text-lg font-bold">{t(activeTourStep.title)}</h2>
                </div>
              </div>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={dismissTour}>{t('Skip')}</button>
              </div>
              <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300" animate={{ width: `${((tourStep + 1) / TOUR_STEPS.length) * 100}%` }} />
              </div>
              <p className="min-h-20 text-sm leading-6 text-emerald-50/80">{t(activeTourStep.description)}</p>
              {activeTourStep.target === 'language-selector' && (
                <div className="my-5 rounded-xl bg-white/5 p-4">
                  <p className="mb-3 text-xs text-emerald-100/60">{t('Try choosing a language. You can change it again anytime.')}</p>
                  <LanguageSelect />
                </div>
              )}
              <div className="mt-6 flex items-center justify-between gap-3">
                <button type="button" className="btn-ghost" onClick={retreatTour} disabled={tourStep === 0}><ChevronLeft size={16} />{t('Back')}</button>
                <button type="button" className="btn" onClick={advanceTour}>{tourStep === TOUR_STEPS.length - 1 ? t('Finish') : t('Next')} {tourStep === TOUR_STEPS.length - 1 ? null : <ChevronRight size={16} />}</button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <main className="mx-auto max-w-7xl px-4 py-8 print:max-w-none print:p-0">{children}</main>
      {!isAdmin && <button
        type="button"
        onClick={() => navigate('/farm-assistant', { state: { startVoiceAt: Date.now() } })}
        aria-label={t('Ask Farm Assistant by voice')}
        title={t('Ask Farm Assistant by voice')}
        className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full border border-emerald-200/30 bg-gradient-to-br from-emerald-400 to-lime-400 text-emerald-950 shadow-xl shadow-emerald-950/40 transition hover:scale-105 hover:shadow-emerald-400/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300 print:hidden"
      >
        <Mic size={23} strokeWidth={2.5} />
      </button>}
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center"><Backdrop /><motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}><Logo /></motion.div></div>;
  if (user?.role === 'admin') {
    return (
      <Layout>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Layout>
    );
  }
  const isPublicPage = ['/about', '/contact'].includes(location.pathname);
  if (isPublicPage) {
    return (
      <PublicPage>
        <Routes location={location} key={location.pathname}>
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </PublicPage>
    );
  }
  if (!user) return <Landing />;
  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/fields" element={<Fields />} />
          <Route path="/scan" element={<Scanner />} />
          <Route path="/map" element={<HealthMap />} />
          <Route path="/nearby-help" element={<NearbyHelp />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/history" element={<History />} />
          <Route path="/report" element={<Report />} />
          <Route path="/farm-assistant" element={<FarmChat />} />
          <Route path="/admin" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
}
