import { Activity, HandHelping, Leaf, ShieldCheck } from 'lucide-react';
import { PageWrap, SectionTitle } from '../components/ui.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const principles = [
  [Leaf, 'Built for practical farming', 'Organise fields and crop scans so farmers can focus attention where it may be needed.'],
  [Activity, 'A screening aid, not a diagnosis', 'AI results can be uncertain. Check crop symptoms in the field and consult a qualified local adviser before acting.'],
  [ShieldCheck, 'Clear and careful guidance', 'CropGuard highlights areas to inspect; it does not prescribe pesticide products or doses.'],
  [HandHelping, 'Connect with local support', 'Find nearby agricultural offices, nurseries, suppliers, markets and other agriculture-related locations.'],
];

export default function About() {
  const { t } = useLanguage();
  return (
    <PageWrap>
      <SectionTitle icon={Leaf} title={t('About CropGuard AI')} />
      <div className="glass mb-6 w-full p-6">
        <p className="text-lg leading-8 text-emerald-50/85">
          {t('CropGuard AI helps farmers organise crop observations, screen leaf photos and find nearby agriculture-related places. It is designed to support timely inspection—not replace a farmer’s judgement or local agricultural expertise.')}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {principles.map(([Icon, title, description]) => (
          <article key={title} className="glass p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><Icon size={20} /></span>
            <h2 className="mt-4 font-semibold">{t(title)}</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-100/60">{t(description)}</p>
          </article>
        ))}
      </div>
    </PageWrap>
  );
}
