const AI_URL = () => process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

async function predict(buffer, filename, mime) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), filename);
  let res;
  try {
    res = await fetch(`${AI_URL()}/predict`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
  } catch (e) {
    throw new Error(`AI service unreachable: ${e.name === 'TimeoutError' ? 'timeout' : e.message}`);
  }
  let body = null;
  try { body = await res.json(); } catch { /* handled below */ }
  if (!res.ok) throw new Error(`AI service error (${res.status}): ${(body && body.detail) || 'unknown'}`);
  if (!body || typeof body.prediction !== 'string' || typeof body.confidence !== 'number') {
    throw new Error('AI service returned an invalid response');
  }
  return body;
}

async function droneRequest(endpoint, buffer, filename, mime, options = {}) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), filename);
  if (endpoint === 'analyze') {
    if (options.apiKey) form.append('gemini_api_key', options.apiKey);
    if (options.model) form.append('gemini_model', options.model);
    if (options.language) form.append('language', options.language);
  }
  let res;
  try {
    res = await fetch(`${AI_URL()}/drone/${endpoint}`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(endpoint === 'analyze' ? 120000 : 70000),
    });
  } catch (e) {
    throw new Error(`AI service unreachable: ${e.name === 'TimeoutError' ? 'timeout' : e.message}`);
  }
  let body = null;
  try { body = await res.json(); } catch { /* handled below */ }
  if (!res.ok) throw new Error(`AI service error (${res.status}): ${(body && body.detail) || 'unknown'}`);
  if (!body || (endpoint === 'analyze' && !Array.isArray(body.regions))) {
    throw new Error('AI service returned an invalid drone-analysis response');
  }
  return body;
}

async function health() {
  try {
    const res = await fetch(`${AI_URL()}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok ? await res.json() : { status: 'down' };
  } catch {
    return { status: 'down' };
  }
}

module.exports = {
  predict,
  dronePreview: (buffer, filename, mime) => droneRequest('preview', buffer, filename, mime),
  droneAnalyze: (buffer, filename, mime, options) => droneRequest('analyze', buffer, filename, mime, options),
  health,
};
