const aiClient = require('../services/aiClient');

function mimeForType(type) {
  return {
    jpg: 'image/jpeg',
    png: 'image/png',
    tiff: 'image/tiff',
  }[type];
}

async function forward(req, res, action) {
  const { buffer, originalname, detectedType } = req.file;
  try {
    const result = await action(buffer, originalname, mimeForType(detectedType));
    return res.json(result);
  } catch (error) {
    return res.status(502).json({ error: 'Drone image analysis failed', detail: String(error.message).slice(0, 300) });
  }
}

exports.preview = async (req, res) => forward(req, res, aiClient.dronePreview);
exports.analyze = async (req, res) => {
  const language = req.body?.language || 'en';
  if (!['en', 'hi', 'mr'].includes(language)) return res.status(400).json({ error: 'Choose English, Hindi, or Marathi.' });
  return forward(req, res, (buffer, filename, mime) => aiClient.droneAnalyze(
    buffer,
    filename,
    mime,
    { apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY, model: process.env.GEMINI_MODEL, language },
  ));
};
