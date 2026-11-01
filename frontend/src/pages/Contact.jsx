import { useState } from 'react';
import { Mail } from 'lucide-react';
import { ErrorBox } from '../components/common.jsx';
import { PageWrap, SectionTitle } from '../components/ui.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { api } from '../services/api.js';

const initialForm = { name: '', email: '', subject: '', message: '' };

export default function Contact() {
  const { t } = useLanguage();
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await api.contact(form);
      setResult(response);
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <PageWrap className="max-w-3xl">
      <SectionTitle icon={Mail} title={t('Contact us')} />
      <p className="mb-6 text-sm leading-6 text-emerald-100/60">
        {t('Send the CropGuard team a question or feedback. Your message is saved securely for the team to review.')}
      </p>
      <form className="glass space-y-4 p-5 sm:p-7" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="contact-name">{t('Name')}</label>
            <input id="contact-name" className="input" value={form.name} onChange={update('name')} maxLength={80} required />
          </div>
          <div>
            <label className="label" htmlFor="contact-email">{t('Email')}</label>
            <input id="contact-email" type="email" className="input" value={form.email} onChange={update('email')} maxLength={254} required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="contact-subject">{t('Subject')}</label>
          <input id="contact-subject" className="input" value={form.subject} onChange={update('subject')} maxLength={120} required />
        </div>
        <div>
          <label className="label" htmlFor="contact-message">{t('Message')}</label>
          <textarea id="contact-message" className="input min-h-36 resize-y" value={form.message} onChange={update('message')} maxLength={5000} required />
        </div>
        <ErrorBox error={error} />
        {result && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${result.emailSent ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/25 bg-amber-400/10 text-amber-100'}`} role="status">
            {result.emailSent
              ? t('Your message was saved and an email notification was sent.')
              : t('Your message was saved to the admin inbox. Email notification is not configured yet.')}
          </div>
        )}
        <button className="btn" type="submit" disabled={busy}>{busy ? t('Sending…') : t('Send message')}</button>
      </form>
    </PageWrap>
  );
}
