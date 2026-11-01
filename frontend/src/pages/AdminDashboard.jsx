import { useCallback, useEffect, useState } from 'react';
import { Inbox, ShieldCheck, Users } from 'lucide-react';
import { ErrorBox } from '../components/common.jsx';
import { PageWrap, SectionTitle, Skeleton } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { api } from '../services/api.js';

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between text-xs text-emerald-100/50">{label}<Icon size={16} className="text-emerald-300" /></div>
      <div className="mt-2 text-2xl font-bold">{value ?? '—'}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingUser, setSavingUser] = useState('');
  const [savingMessage, setSavingMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextOverview, nextUsers, nextMessages] = await Promise.all([
        api.adminOverview(),
        api.adminUsers(),
        api.adminMessages(),
      ]);
      setOverview(nextOverview);
      setUsers(nextUsers.users);
      setMessages(nextMessages.messages);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRole = async (id, role) => {
    setSavingUser(id);
    setError('');
    try {
      const response = await api.updateUserRole(id, role);
      setUsers((current) => current.map((item) => (String(item._id) === id ? { ...item, role: response.user.role } : item)));
      const nextOverview = await api.adminOverview();
      setOverview(nextOverview);
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setSavingUser('');
    }
  };

  const markRead = async (id) => {
    setSavingMessage(id);
    setError('');
    try {
      const response = await api.markAdminMessageRead(id);
      setMessages((current) => current.map((message) => (String(message._id) === id ? response.message : message)));
      setOverview((current) => current ? { ...current, unreadMessages: Math.max(0, current.unreadMessages - 1) } : current);
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setSavingMessage('');
    }
  };

  return (
    <PageWrap>
      <SectionTitle icon={ShieldCheck} title={t('Admin dashboard')}>
        <button className="btn-ghost" onClick={load} disabled={loading}>{t('Refresh')}</button>
      </SectionTitle>
      <p className="mb-5 text-sm text-emerald-100/55">{t('Signed in as administrator:')} {user.email}</p>
      <ErrorBox error={error} />
      {loading && !overview ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label={t('Users')} value={overview?.users} icon={Users} />
            <Metric label={t('Administrators')} value={overview?.admins} icon={ShieldCheck} />
            <Metric label={t('Fields')} value={overview?.fields} icon={Users} />
            <Metric label={t('Scans')} value={overview?.scans} icon={Users} />
            <Metric label={t('Unread messages')} value={overview?.unreadMessages} icon={Inbox} />
          </div>

          <section className="glass mt-6 overflow-hidden">
            <div className="border-b border-white/10 px-5 py-4"><h2 className="font-semibold">{t('User accounts')}</h2></div>
            {users.length === 0 ? <p className="p-5 text-sm text-emerald-100/50">{t('No accounts found.')}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="text-xs text-emerald-100/45"><tr><th className="px-5 py-3">{t('Name')}</th><th className="px-5 py-3">{t('Email')}</th><th className="px-5 py-3">{t('Created')}</th><th className="px-5 py-3">{t('Role')}</th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((account) => {
                      const id = String(account._id);
                      return (
                        <tr key={id}>
                          <td className="px-5 py-3">{account.name}</td>
                          <td className="px-5 py-3 text-emerald-100/65">{account.email}</td>
                          <td className="px-5 py-3 text-xs text-emerald-100/45">{new Date(account.createdAt).toLocaleDateString()}</td>
                          <td className="px-5 py-3">
                            <select className="input !w-auto !py-1.5" value={account.role || 'farmer'} disabled={savingUser === id || (id === String(user.id) && account.role === 'admin')} onChange={(event) => updateRole(id, event.target.value)} aria-label={`${t('Role')} ${account.email}`}>
                              <option value="farmer">{t('Farmer')}</option>
                              <option value="admin">{t('Admin')}</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-6 space-y-3">
            <h2 className="flex items-center gap-2 font-semibold"><Inbox size={17} className="text-emerald-300" />{t('Contact inbox')}</h2>
            {messages.length === 0 ? <div className="glass p-5 text-sm text-emerald-100/50">{t('No contact messages yet.')}</div> : messages.map((message) => (
              <article key={message._id} className={`glass p-5 ${message.readAt ? 'opacity-75' : 'border-emerald-400/30'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{message.subject}</h3>
                    <p className="mt-1 text-xs text-emerald-100/50">{message.name} · {message.email} · {new Date(message.createdAt).toLocaleString()}</p>
                  </div>
                  {!message.readAt && <button className="btn-ghost !px-3 !py-2 text-xs" disabled={savingMessage === String(message._id)} onClick={() => markRead(String(message._id))}>{t('Mark as read')}</button>}
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-emerald-100/75">{message.message}</p>
              </article>
            ))}
          </section>
        </>
      )}
    </PageWrap>
  );
}
