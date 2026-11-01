import { Link } from 'react-router-dom';
import { Backdrop, Logo } from '../components/ui.jsx';
import { LanguageSelect, useLanguage } from '../context/LanguageContext.jsx';

export default function PublicPage({ children }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen">
      <Backdrop />
      <header className="border-b border-white/10 bg-[#06140d]/70 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4">
          <Link to="/"><Logo /></Link>
          <nav aria-label={t('Public pages')} className="flex items-center gap-2 text-sm">
            <Link to="/about" className="btn-ghost !px-3 !py-2">{t('About us')}</Link>
            <Link to="/contact" className="btn-ghost !px-3 !py-2">{t('Contact us')}</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSelect />
            <Link to="/" className="text-sm text-emerald-300 hover:underline">{t('Back to CropGuard')}</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
      <footer className="border-t border-white/10 px-4 py-6 text-center text-xs text-emerald-100/40">
        <Link to="/about" className="mx-3 hover:text-emerald-200">{t('About us')}</Link>
        <Link to="/contact" className="mx-3 hover:text-emerald-200">{t('Contact us')}</Link>
        <span className="mx-3">CropGuard AI</span>
      </footer>
    </div>
  );
}
