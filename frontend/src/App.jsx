import { AnimatePresence, motion } from 'framer-motion';
import { Activity, History as HistoryIcon, LayoutDashboard, ListChecks, LogOut, Map as MapIcon, MessageCircle, Mic, ScanLine, Sprout, HandHelping, Info, Mail, ShieldCheck } from 'lucide-react';
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

function Layout({ children }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const links = [
    ...secondaryLinks,
    ...(user.role === 'admin' ? [['/admin', 'Admin', ShieldCheck]] : []),
    ['/about', 'About us', Info],
    ['/contact', 'Contact us', Mail],
  ];
  const isActive = (to) => to === '/' ? pathname === '/' : pathname.startsWith(to);
  return (
    <div className="min-h-screen">
      <Backdrop />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#06140d]/70 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Logo size={24} />
          <nav aria-label="Main sections" className="ml-2 hidden items-center gap-1 text-sm lg:flex">
            {primaryLinks.map(([to, label, Icon]) => (
              <NavLink key={to} to={to} end={to === '/'} className={`relative flex items-center gap-2 rounded-lg px-3 py-2 transition ${isActive(to) ? 'text-emerald-950' : 'text-emerald-100/70 hover:bg-white/5 hover:text-white'}`}>
                {isActive(to) && <motion.span layoutId="primary-nav-pill" className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-400 to-lime-400" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                <span className="relative z-10 flex items-center gap-2 font-medium"><Icon size={16} />{t(label)}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <LanguageSelect />
            <span className="hidden text-emerald-100/60 sm:inline">{user.name}</span>
            <button onClick={logout} className="btn-ghost !px-3" title={t('Log out')}><LogOut size={16} /><span className="hidden sm:inline">{t('Log out')}</span></button>
          </div>
        </div>
        <nav aria-label="Main sections" className="flex gap-1 overflow-x-auto border-t border-white/5 px-3 py-2 text-xs lg:hidden">
          {primaryLinks.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 ${isActive(to) ? 'bg-emerald-400 text-emerald-950' : 'bg-white/5 text-emerald-100/70'}`}>
              <Icon size={14} />{t(label)}
            </NavLink>
          ))}
        </nav>
        <nav aria-label="More sections" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto border-t border-white/10 bg-black/10 px-4 py-1.5 text-xs">
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 transition ${isActive(to) ? 'bg-emerald-400/15 text-emerald-200' : 'text-emerald-100/45 hover:bg-white/5 hover:text-emerald-100/80'}`}>
              <Icon size={14} />{t(label)}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 print:max-w-none print:p-0">{children}</main>
      <button
        type="button"
        onClick={() => navigate('/farm-assistant', { state: { startVoiceAt: Date.now() } })}
        aria-label={t('Ask Farm Assistant by voice')}
        title={t('Ask Farm Assistant by voice')}
        className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full border border-emerald-200/30 bg-gradient-to-br from-emerald-400 to-lime-400 text-emerald-950 shadow-xl shadow-emerald-950/40 transition hover:scale-105 hover:shadow-emerald-400/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300 print:hidden"
      >
        <Mic size={23} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center"><Backdrop /><motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}><Logo /></motion.div></div>;
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
          <Route path="/admin" element={user.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
}
