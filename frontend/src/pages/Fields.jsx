import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, ScanLine, Sprout, Trash2, Map as MapIcon } from 'lucide-react';
import { api } from '../services/api.js';
import { PageWrap, SectionTitle, Skeleton, rise, stagger, useToast } from '../components/ui.jsx';
import { ErrorBox, useFields } from '../components/common.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const CROPS = ['tomato', 'potato', 'pepper', 'corn', 'apple', 'grape', 'other'];

export default function Fields() {
  const { t } = useLanguage();
  const { fields, loading, error: loadError, reload, setSelected } = useFields();
  const nav = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', cropType: 'tomato', areaAcres: 2, gridRows: 6, gridColumns: 8 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { field } = await api.createField({ ...form, areaAcres: Number(form.areaAcres), gridRows: Number(form.gridRows), gridColumns: Number(form.gridColumns) });
      setSelected(field._id);
      setForm({ ...form, name: '' });
      await reload();
      toast(`${t('Field')} "${field.name}" ${t('created')}`, 'success');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const remove = async (f) => {
    if (!window.confirm(`${t('Delete')} "${f.name}" ${t('and all of its scans? This cannot be undone.')}`)) return;
    try { await api.deleteField(f._id); await reload(); toast(t('Field deleted'), 'info'); } catch (err) { toast(t(err.message), 'error'); }
  };

  return (
    <PageWrap>
      <SectionTitle icon={Sprout} title={t('Fields')} />
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={create} className="glass h-fit space-y-4 p-5">
          <h2 className="font-semibold">{t('New field')}</h2>
          <div><label className="label">{t('Name')}</label><input className="input" value={form.name} onChange={set('name')} required placeholder={t('Farm Field A')} /></div>
          <div><label className="label">{t('Crop')}</label><select className="input" value={form.cropType} onChange={set('cropType')}>{CROPS.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></div>
          <div><label className="label">{t('Area (acres)')}</label><input type="number" step="0.01" min="0.01" className="input" value={form.areaAcres} onChange={set('areaAcres')} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">{t('Rows (1–26)')}</label><input type="number" min="1" max="26" className="input" value={form.gridRows} onChange={set('gridRows')} required /></div>
            <div><label className="label">{t('Columns (1–30)')}</label><input type="number" min="1" max="30" className="input" value={form.gridColumns} onChange={set('gridColumns')} required /></div>
          </div>
          <ErrorBox error={error} />
          <button className="btn w-full" disabled={busy}><Plus size={16} />{busy ? t('Creating…') : t('Create field')}</button>
        </form>

        <div className="space-y-4 lg:col-span-2">
          <ErrorBox error={loadError} />
          {loading && <><Skeleton className="h-28" /><Skeleton className="h-28" /></>}
          {!loading && fields.length === 0 && <div className="glass p-10 text-center text-emerald-100/50">{t('No fields yet. Create your first field to start scanning.')}</div>}
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
            <AnimatePresence>
              {fields.map((f) => (
                <motion.div key={f._id} variants={rise} layout exit={{ opacity: 0, scale: 0.95 }} className="glass glass-hover p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{f.name}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 capitalize text-emerald-300">{t(f.cropType)}</span>
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-emerald-100/60">{f.areaAcres} {t('acres')}</span>
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-emerald-100/60">{f.gridRows}×{f.gridColumns} = {f.gridRows * f.gridColumns} {t('zones')}</span>
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-emerald-100/60">{f.scanCount} {t('scans')}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-ghost" onClick={() => { setSelected(f._id); nav('/scan'); }}><ScanLine size={15} />{t('Scan')}</button>
                      <button className="btn-ghost" onClick={() => { setSelected(f._id); nav('/map'); }}><MapIcon size={15} />{t('Map')}</button>
                      <button className="btn-ghost !text-rose-300" onClick={() => remove(f)} title={t('Delete')}><Trash2 size={15} /></button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </PageWrap>
  );
}