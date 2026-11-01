import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowRight, Camera, Download, Leaf, Plane, RefreshCw, ScanLine, Upload, X } from 'lucide-react';
import { api } from '../services/api.js';
import { ConfidenceRing, PageWrap, SectionTitle, useToast } from '../components/ui.jsx';
import { DemoTag, ErrorBox, FieldSelect, GridMap, Legend, NoFields, STATUS, StatusBadge, nice, pct, useFields } from '../components/common.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const MAX = 8 * 1024 * 1024;
const MAX_DRONE = 50 * 1024 * 1024;
const DRONE_TYPES = ['jpg', 'jpeg', 'png', 'tif', 'tiff'];

function formatBytes(bytes) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function DroneScanner() {
  const { t, language } = useLanguage();
  const toast = useToast();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [viewMode, setViewMode] = useState('health');

  useEffect(() => {
    if (!file) {
      setPreview(null);
      setDimensions(null);
      setPreviewLoading(false);
      return undefined;
    }

    let cancelled = false;
    let objectUrl;
    const extension = file.name.split('.').pop().toLowerCase();
    if (extension === 'tif' || extension === 'tiff') {
      setPreviewLoading(true);
      api.dronePreview(file).then((data) => {
        if (cancelled) return;
        setPreview(data.preview);
        setDimensions({ width: data.width, height: data.height });
      }).catch((e) => {
        if (!cancelled) setError(e.message);
      }).finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    } else {
      objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      const image = new Image();
      image.onload = () => {
        if (!cancelled) setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        if (!cancelled) setError(t('Unable to preview this image. Please choose a valid image file.'));
      };
      image.src = objectUrl;
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const accept = (nextFile) => {
    setError('');
    setResult(null);
    setSelectedRegionId('');
    if (!nextFile) return setFile(null);
    const extension = nextFile.name.split('.').pop().toLowerCase();
    if (!DRONE_TYPES.includes(extension)) {
      setError(t('Choose a JPG, JPEG, PNG, TIF, or TIFF image.'));
      setFile(null);
      return;
    }
    if (nextFile.size > MAX_DRONE) {
      setError(t('Drone image is larger than 50 MB.'));
      setFile(null);
      return;
    }
    setFile(nextFile);
  };

  const analyze = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const analysis = await api.droneAnalyze(file);
      setResult(analysis);
      setSelectedRegionId(analysis.regions[0]?.region_id || '');
      toast(t('Drone image analysis complete'), 'success');
    } catch (e) {
      setError(e.message);
      toast(t('Drone analysis failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const selectedRegion = result?.regions.find((region) => region.region_id === selectedRegionId);
  const healthColor = {
    Healthy: '#34d399',
    'Mild Stress': '#facc15',
    'Moderate Stress': '#fb923c',
    'Severe Stress': '#f43f5e',
    Uncertain: '#94a3b8',
  };
  const healthLabels = ['Healthy', 'Mild Stress', 'Moderate Stress', 'Severe Stress', 'Uncertain'];
  const downloadReport = () => {
    if (!result) return;
    const stats = [
      ['Healthy', result.healthy_regions, result.healthy_area_percent],
      ['Mild Stress', result.mild_stress_regions, result.mild_stress_area_percent],
      ['Moderate Stress', result.moderate_stress_regions, result.moderate_stress_area_percent],
      ['Severe Stress', result.severe_stress_regions, result.severe_stress_area_percent],
      ['Uncertain', result.uncertain_regions, result.uncertain_area_percent],
    ];
    const rows = result.regions.map((region) => `<tr><td>${escapeHtml(region.region_id)}</td><td>${escapeHtml(region.health)}</td><td>${region.health_score == null ? '—' : `${region.health_score}/100`}</td><td>${region.confidence == null ? '—' : `${region.confidence}%`}</td><td>${escapeHtml(region.symptoms.join('; ') || '—')}</td><td>${escapeHtml(region.possible_causes.join('; ') || '—')}</td><td>${escapeHtml(region.recommended_action)}</td></tr>`).join('');
    const summary = stats.map(([label, count, area]) => `<tr><td>${escapeHtml(t(label))}</td><td>${count}</td><td>${area}%</td></tr>`).join('');
    const observations = result.observations.map((observation) => `<li>${escapeHtml(observation)}</li>`).join('');
    const html = `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(t('Drone field health report'))}</title><style>body{font:14px/1.5 Arial,sans-serif;color:#17221b;max-width:1200px;margin:32px auto;padding:0 20px}h1,h2{color:#14532d}img{display:block;width:100%;height:auto;border:1px solid #cbd5d0;border-radius:8px}table{width:100%;border-collapse:collapse;margin:16px 0 28px}th,td{text-align:left;vertical-align:top;padding:8px;border:1px solid #d5ddd8}th{background:#edf4ef}section{margin:28px 0}.stats{display:flex;flex-wrap:wrap;gap:12px}.stats div{padding:10px 14px;border:1px solid #d5ddd8;border-radius:8px}</style></head><body><h1>${escapeHtml(t('Drone field health report'))}</h1><p>${escapeHtml(file?.name || '')} · ${result.image_width} × ${result.image_height} px · ${new Date().toLocaleString()}</p><section><h2>${escapeHtml(t('Field health statistics'))}</h2><div class="stats"><div>${escapeHtml(t('Total regions'))}: ${result.total_regions}</div><div>${escapeHtml(t('Estimated healthy area'))}: ${result.overall_health_percent}%</div><div>${escapeHtml(t('Estimated affected area'))}: ${result.affected_area_percent}%</div></div><table><thead><tr><th>${escapeHtml(t('Health condition'))}</th><th>${escapeHtml(t('Regions'))}</th><th>${escapeHtml(t('Area'))}</th></tr></thead><tbody>${summary}</tbody></table></section><section><h2>${escapeHtml(t('Health Mapping Mode'))}</h2><img src="${result.annotated_image}" alt="${escapeHtml(t('Annotated field health map'))}"></section><section><h2>${escapeHtml(t('AI observations'))}</h2><ul>${observations}</ul></section><section><h2>${escapeHtml(t('Grid-wise analysis and recommendations'))}</h2><table><thead><tr><th>${escapeHtml(t('Region'))}</th><th>${escapeHtml(t('Health condition'))}</th><th>${escapeHtml(t('Health score'))}</th><th>${escapeHtml(t('AI confidence'))}</th><th>${escapeHtml(t('Visible symptoms'))}</th><th>${escapeHtml(t('Possible causes'))}</th><th>${escapeHtml(t('Recommended action'))}</th></tr></thead><tbody>${rows}</tbody></table><p>${escapeHtml(result.analysis_note)}</p></section></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(file?.name || 'drone-image').replace(/\.[^.]+$/, '')}-health-report.html`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass space-y-5 p-5">
        <div>
          <div className="font-semibold">{t('Drone / Aerial Image Scanner')}</div>
          <p className="mt-1 text-xs text-emerald-100/45">{t('Upload a high-resolution field image for region-by-region analysis.')}</p>
        </div>
        <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.tif,.tiff,image/jpeg,image/png,image/tiff" className="hidden" disabled={busy}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => { accept(event.target.files[0]); event.target.value = ''; }} />
        <div aria-busy={busy} onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(event) => { event.preventDefault(); setDrag(false); if (!busy) accept(event.dataTransfer.files[0]); }}
          onClick={() => { if (!busy) inputRef.current?.click(); }}
          className={`relative grid min-h-[16rem] cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition ${drag ? 'border-emerald-300 bg-emerald-400/10' : 'border-white/15 hover:border-emerald-400/50 hover:bg-white/[0.03]'}`}>
          {preview ? (
            <img src={preview} alt="Drone image preview" className="max-h-[28rem] w-full object-contain" />
          ) : (
            <div className="p-8 text-center">
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.2 }} className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"><Upload /></motion.div>
              <div className="font-medium">{t('Drop an aerial field image here')}</div>
              <div className="mt-1 text-xs text-emerald-100/45">{t('JPG, JPEG, PNG, TIF, TIFF · max 50 MB')}</div>
              <button type="button" className="btn-ghost mt-4" disabled={busy} onClick={(event) => { event.stopPropagation(); inputRef.current?.click(); }}>{t('Browse images')}</button>
            </div>
          )}
          {previewLoading && <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm">{t('Preparing TIFF preview…')}</div>}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-black/55 p-4 text-center backdrop-blur-[2px]" role="status" aria-live="polite">
              <div className="rounded-2xl border border-emerald-300/20 bg-[#06140d]/90 px-5 py-4 shadow-xl">
                <div className="mx-auto mb-2 h-7 w-7 animate-spin rounded-full border-2 border-emerald-200/20 border-t-emerald-300" />
                <div className="text-sm font-semibold text-emerald-50">{t('Analyzing all 100 grid cells')}</div>
                <div className="mt-1 text-xs text-emerald-100/55">{t('Gemini is reviewing the image patches. This can take up to a minute.')}</div>
              </div>
            </div>
          )}
        </div>
        {file && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
            <div className="min-w-0">
              <div className="truncate font-medium text-emerald-50">{file.name}</div>
              <div className="mt-1 text-emerald-100/45">
                {dimensions ? `${dimensions.width.toLocaleString()} × ${dimensions.height.toLocaleString()} px` : t('Reading image dimensions…')} · {formatBytes(file.size)}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost !px-3 !py-2" disabled={busy} onClick={() => inputRef.current?.click()} aria-label={t('Replace image')}><RefreshCw size={14} />{t('Replace')}</button>
              <button type="button" className="btn-ghost !px-3 !py-2" disabled={busy} onClick={() => { setFile(null); setResult(null); setError(''); }} aria-label={t('Remove image')}><X size={14} />{t('Remove')}</button>
            </div>
          </div>
        )}
        <ErrorBox error={error} />
        <button className="btn w-full" disabled={!file || !dimensions || previewLoading || busy} onClick={analyze}>
          {busy ? t('Analyzing regions…') : <>{t('Analyze Drone Image')}<ArrowRight size={16} /></>}
        </button>
        <p className="text-[11px] leading-relaxed text-amber-100/55">
          {t('Gemini visually assesses image patches. This is an uncalibrated AI estimate, not a verified crop diagnosis; verify concerning regions on-site.')}
        </p>
      </div>

      <div className="glass space-y-4 p-5">
        <h2 className="font-semibold">{t('Gemini drone image analysis')}</h2>
        {!result ? (
          <p className="py-20 text-center text-sm text-emerald-100/40">{busy ? t('Gemini is assessing the aerial image regions…') : t('Upload an aerial image to view Gemini’s region assessments.')}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{t('Field health statistics')}</h3>
                <p className="text-xs text-emerald-100/45">{result.total_regions} {t('individually analyzed grid cells')}</p>
              </div>
              <button type="button" className="btn-ghost" onClick={downloadReport}><Download size={15} />{t('Download report')}</button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ['Total regions', result.total_regions, '#d1fae5'],
                ['Healthy area', `${result.healthy_area_percent}% · ${result.healthy_regions}`, healthColor.Healthy],
                ['Mild stress', `${result.mild_stress_area_percent}% · ${result.mild_stress_regions}`, healthColor['Mild Stress']],
                ['Moderate stress', `${result.moderate_stress_area_percent}% · ${result.moderate_stress_regions}`, healthColor['Moderate Stress']],
                ['Severe stress', `${result.severe_stress_area_percent}% · ${result.severe_stress_regions}`, healthColor['Severe Stress']],
                ['Uncertain', `${result.uncertain_area_percent}% · ${result.uncertain_regions}`, healthColor.Uncertain],
                ['Estimated affected area', `${result.affected_area_percent}%`, healthColor['Severe Stress']],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-100/40">{t(label)}</div>
                  <div className="mt-1 text-lg font-bold" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-3 text-[11px] text-emerald-100/65">
                {healthLabels.map((label) => <span key={label} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: healthColor[label] }} />{t(label)}</span>)}
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t('Drone analysis viewing mode')}>
                <button type="button" aria-pressed={viewMode === 'health'} onClick={() => setViewMode('health')} className={`rounded-lg px-3 py-2 text-xs ${viewMode === 'health' ? 'bg-emerald-400 text-emerald-950' : 'bg-white/5 text-emerald-100/65'}`}>{t('Health Mapping Mode')}</button>
                <button type="button" aria-pressed={viewMode === 'precision'} onClick={() => setViewMode('precision')} className={`rounded-lg px-3 py-2 text-xs ${viewMode === 'precision' ? 'bg-emerald-400 text-emerald-950' : 'bg-white/5 text-emerald-100/65'}`}>{t('Precision Treatment Mode')}</button>
              </div>
              <div className="relative w-full overflow-hidden rounded-xl border border-white/10" style={{ aspectRatio: `${result.image_width} / ${result.image_height}` }}>
                <img src={preview} alt={t('Drone image with interactive crop health grid')} className="absolute inset-0 h-full w-full object-fill" />
                {result.regions.map((region) => (
                  <button key={region.region_id} type="button"
                    aria-label={`${t('Select region')} ${region.region_id}: ${t(region.health)}`}
                    title={`${region.region_id}: ${t(region.health)} · ${t('Health score')} ${region.health_score ?? '—'}`}
                    onClick={() => setSelectedRegionId(region.region_id)}
                    className={`absolute flex items-center justify-center border border-white/35 text-[clamp(5px,0.65vw,10px)] font-semibold text-white [text-shadow:0_1px_2px_#000] transition hover:border-white ${selectedRegionId === region.region_id ? '!z-10 !border-2 !border-white' : ''} ${viewMode === 'precision' && region.health === 'Healthy' ? 'pointer-events-none opacity-0' : ''}`}
                    style={{
                      left: `${region.bounds.x / result.image_width * 100}%`,
                      top: `${region.bounds.y / result.image_height * 100}%`,
                      width: `${region.bounds.width / result.image_width * 100}%`,
                      height: `${region.bounds.height / result.image_height * 100}%`,
                      backgroundColor: `${healthColor[region.health]}66`,
                    }} />
                ))}
              </div>
              {selectedRegion && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{selectedRegion.region_id}</span>
                    <span className="rounded-full border px-2 py-0.5 text-xs" style={{ color: healthColor[selectedRegion.health], borderColor: `${healthColor[selectedRegion.health]}66` }}>{t(selectedRegion.health)}</span>
                    <span className="text-xs text-emerald-100/60">{t('Health score')}: {selectedRegion.health_score == null ? '—' : `${selectedRegion.health_score}/100`}</span>
                    <span className="ml-auto text-xs text-emerald-100/60">{t('AI confidence')}: {selectedRegion.confidence == null ? '—' : `${selectedRegion.confidence}%`}</span>
                  </div>
                  <div className="mt-2 text-xs text-emerald-100/55">
                    {t('Visible cues:')} {selectedRegion.symptoms.length ? selectedRegion.symptoms.join('; ') : t('No specific visible symptoms reported.')}
                  </div>
                  <div className="mt-2 text-xs text-emerald-100/55">{t('Possible causes')}: {selectedRegion.possible_causes.length ? selectedRegion.possible_causes.join('; ') : t('No specific possible cause identified.')}</div>
                  <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs"><b>{t('Recommended action')}:</b> {selectedRegion.recommended_action}</div>
                  <div className="mt-1 text-[11px] text-emerald-100/35">{t('Confidence is an uncalibrated estimate, not a probability.')}</div>
                </div>
              )}
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-100/55"><Activity size={14} />{t('Gemini observations')}</div>
              {result.observations.map((observation) => <p key={observation} className="text-xs leading-relaxed text-emerald-50/75">{observation}</p>)}
              <p className="pt-1 text-[10px] text-amber-100/50">{t(result.analysis_note)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Scanner() {
  const { t } = useLanguage();
  const { fields, loading, selected, setSelected, field } = useFields();
  const toast = useToast();
  const inputRef = useRef(null);
  const zoneRef = useRef('A1');
  const [zone, setZone] = useState('A1');
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [scannerMode, setScannerMode] = useState('leaf');
  const [fieldMap, setFieldMap] = useState(null);
  const [fieldMapLoading, setFieldMapLoading] = useState(false);
  const [fieldMapError, setFieldMapError] = useState('');

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  useEffect(() => {
    if (!selected) {
      setFieldMap(null);
      return undefined;
    }
    let cancelled = false;
    setFieldMap(null);
    setFieldMapError('');
    setFieldMapLoading(true);
    api.healthMap(selected)
      .then((data) => { if (!cancelled) setFieldMap(data); })
      .catch((e) => { if (!cancelled) setFieldMapError(e.message); })
      .finally(() => { if (!cancelled) setFieldMapLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  const accept = (f) => {
    setResult(null); setError('');
    if (!f) return setFile(null);
    if (!['image/jpeg', 'image/png'].includes(f.type)) { setError(t('Please choose a JPG or PNG image.')); return setFile(null); }
    if (f.size > MAX) { setError(t('Image is larger than 8 MB.')); return setFile(null); }
    setFile(f);
  };

  const analyze = async () => {
    setBusy(true); setError(''); setResult(null);
    try {
      const form = new FormData();
      form.append('fieldId', field._id); form.append('zoneId', zoneRef.current); form.append('image', file);
      const r = await api.createScan(form);
      setResult(r);
      setFieldMapLoading(true);
      setFieldMapError('');
      try {
        const updatedMap = await api.healthMap(field._id);
        setFieldMap(updatedMap);
      } catch (mapError) {
        setFieldMapError(mapError.message);
      } finally {
        setFieldMapLoading(false);
      }
      toast(`${t('Zone')} ${zoneRef.current} ${t('analysed')}`, 'success');
    } catch (e) { setError(e.message); toast(t('Analysis failed'), 'error'); } finally { setBusy(false); }
  };

  if (loading) return null;

  const scan = result?.scan;
  const rec = result?.recommendation;
  const ringColor = result ? STATUS[result.zoneStatus]?.color : undefined;
  const openBlockCamera = (block) => {
    zoneRef.current = block.zoneId;
    setZone(block.zoneId);
    setFile(null);
    setResult(null);
    setError('');
    inputRef.current?.click();
  };

  return (
    <PageWrap>
      <SectionTitle icon={ScanLine} title={t('Crop scanner')} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setScannerMode('leaf')}
          className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${scannerMode === 'leaf' ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><Leaf size={19} /></span>
          <span><span className="block text-sm font-semibold">{t('Small Block / Leaf Scanner')}</span><span className="mt-1 block text-xs text-emerald-100/45">{t('Analyze a single crop or leaf image')}</span></span>
        </button>
        <button type="button" onClick={() => setScannerMode('drone')}
          className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${scannerMode === 'drone' ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><Plane size={19} /></span>
          <span><span className="block text-sm font-semibold">{t('Drone / Aerial Image Scanner')}</span><span className="mt-1 block text-xs text-emerald-100/45">{t('Analyze overlapping regions across a field')}</span></span>
        </button>
      </div>
      {scannerMode === 'drone' ? <DroneScanner /> : !fields.length ? <NoFields /> : <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass space-y-5 p-5">
          <div className="flex flex-wrap gap-4">
            <div><label className="label">{t('Select field')}</label><FieldSelect fields={fields} selected={selected} setSelected={(id) => {
              zoneRef.current = 'A1';
              setZone('A1');
              setFile(null);
              setResult(null);
              setError('');
              setSelected(id);
            }} /></div>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-black/15 p-4">
            <div>
              <h2 className="text-sm font-semibold">{t('Field block health map')}</h2>
              <p className="mt-1 text-xs text-emerald-100/45">{t('Tap a block to open the camera and assign its photo to that block.')}</p>
            </div>
            {fieldMap ? (
              <>
                <Legend />
                <GridMap
                  zones={fieldMap.zones}
                  cols={fieldMap.field.gridColumns}
                  onSelect={openBlockCamera}
                  selectedId={zone}
                  imagePreview={preview}
                  imageZoneId={zone}
                />
                <p className="text-xs text-emerald-100/45">{t('The map shows the latest analysis for each block.')}</p>
              </>
            ) : <p className="py-4 text-center text-xs text-emerald-100/45">{fieldMapLoading ? t('Loading field blocks…') : t('Field health map unavailable.')}</p>}
            <ErrorBox error={fieldMapError} />
            <div className="flex items-center gap-2 text-xs text-emerald-100/60">
              <Camera size={14} />{t('Selected block')}: <b className="text-emerald-100">{zone}</b>
            </div>
          </div>

          <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files[0]); }} onClick={() => inputRef.current?.click()}
            className={`relative grid min-h-[16rem] cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition ${drag ? 'border-emerald-300 bg-emerald-400/10' : 'border-white/15 hover:border-emerald-400/50 hover:bg-white/[0.03]'}`}>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onClick={(e) => e.stopPropagation()} onChange={(e) => { accept(e.target.files[0]); e.target.value = ''; }} />
            {preview ? (
              <>
                <img src={preview} alt={`${t('Photo for block')} ${zone}`} className="max-h-80 w-full object-contain" />
                {busy && (
                  <>
                    <div className="absolute inset-0 bg-emerald-400/10" />
                    <div className="absolute inset-x-0 h-1 animate-scan bg-emerald-300 shadow-[0_0_24px_6px_rgba(110,231,183,0.7)]" />
                  </>
                )}
              </>
            ) : (
              <div className="p-8 text-center">
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.2 }} className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"><Upload /></motion.div>
                <div className="font-medium">{t('Drop a crop image here')}</div>
                <div className="text-xs text-emerald-100/45">{t('Take a photo or browse · JPG/PNG · max 8 MB')}</div>
              </div>
            )}
          </div>
          <ErrorBox error={error} />
          <button className="btn w-full" disabled={!file || busy} onClick={analyze}>{busy ? t('Analysing…') : <>{t('Analyse zone')} {zone}<ArrowRight size={16} /></>}</button>
        </div>

        <div className="glass p-5">
          <h2 className="mb-4 font-semibold">{t('Result')}</h2>
          <AnimatePresence mode="wait">
            {!scan ? (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-20 text-center text-sm text-emerald-100/40">
                {busy ? t('Model is looking at your image…') : t('Upload an image and press Analyse to see the prediction.')}
              </motion.p>
            ) : (
              <motion.div key={scan._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="flex flex-wrap items-center gap-5">
                  <ConfidenceRing value={scan.confidence} color={ringColor} />
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-emerald-100/50">{t('Zone')} {scan.zoneId}</span><StatusBadge status={result.zoneStatus} /><DemoTag demo={scan.demo} /></div>
                    <div className="text-2xl font-extrabold capitalize">{t(nice(scan.prediction))}</div>
                    <div className="text-xs text-emerald-100/50">{t('Certainty:')} <b className="text-emerald-100">{t(scan.certainty)}</b> · {t('model')} v{scan.modelVersion}</div>
                  </div>
                </div>
                {scan.topPredictions?.length > 0 && (
                  <div className="space-y-2">
                    {scan.topPredictions.map((p, i) => (
                      <div key={p.class}>
                        <div className="mb-1 flex justify-between text-xs"><span className="capitalize">{t(nice(p.class))}</span><span className="text-emerald-100/50">{pct(p.score)}</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-emerald-400" initial={{ width: 0 }} animate={{ width: `${p.score * 100}%` }} transition={{ delay: 0.2 + i * 0.1, duration: 0.8 }} /></div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-1 text-xs uppercase tracking-wider text-emerald-100/40">{t('Suggested next step')}</div>
                  <div className="text-sm">{t(rec.action)}</div>
                  {rec.requiresVerification && <div className="mt-2 text-xs font-semibold text-amber-300">{t('Human verification required')}</div>}
                </div>
                <div className="text-[11px] text-emerald-100/35">{t("The score is the model's output, not a guaranteed probability of being correct.")}</div>
                <Link to="/map" className="btn-ghost w-fit">{t('View on health map')} <ArrowRight size={15} /></Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>}
    </PageWrap>
  );
}
