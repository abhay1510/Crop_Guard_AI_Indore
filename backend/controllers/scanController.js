const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Field = require('../models/Field');
const Scan = require('../models/Scan');
const Recommendation = require('../models/Recommendation');
const aiClient = require('../services/aiClient');
const { evaluateScan } = require('../services/recommendations');
const { parseZoneId } = require('../utils/grid');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** Class names look like "Tomato___Early_blight". If the predicted crop differs from the field's crop, the result is unreliable. */
function cropMismatch(fieldCrop, cls) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!fieldCrop || fieldCrop === 'other' || !String(cls).includes('___')) return false;
  const predicted = norm(String(cls).split('___')[0]);
  return !!predicted && !predicted.includes(norm(fieldCrop));
}

exports.create = async (req, res) => {
  const { fieldId, zoneId } = req.body || {};
  if (!mongoose.isValidObjectId(fieldId)) return res.status(400).json({ error: 'Valid fieldId is required' });
  const field = await Field.findOne({ _id: fieldId, ownerId: req.userId });
  if (!field) return res.status(404).json({ error: 'Field not found' });
  const zone = parseZoneId(zoneId, field.gridRows, field.gridColumns);
  if (!zone) return res.status(400).json({ error: `zoneId must be a valid grid cell (e.g. A1 to ${String.fromCharCode(64 + field.gridRows)}${field.gridColumns})` });

  // Store under a random server-generated name; extension comes from detected content type.
  const filename = `${crypto.randomUUID()}.${req.file.detectedType}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), req.file.buffer);

  const scan = await Scan.create({
    fieldId: field._id, ownerId: req.userId, zoneId: zone.zoneId,
    imageUrl: filename, status: 'processing',
  });

  try {
    const mime = req.file.detectedType === 'png' ? 'image/png' : 'image/jpeg';
    const ai = await aiClient.predict(req.file.buffer, filename, mime);
    scan.prediction = ai.prediction;
    scan.confidence = ai.confidence;
    scan.certainty = ai.certainty;
    scan.modelVersion = ai.model_version;
    scan.cropMismatch = cropMismatch(field.cropType, ai.prediction);
    scan.topPredictions = (ai.top_predictions || []).slice(0, 3).map((p) => ({ class: p.class, score: p.score }));
    scan.status = 'completed';
    await scan.save();

    const rec = evaluateScan(scan);
    await Recommendation.create({
      fieldId: field._id, scanId: scan._id, zoneId: zone.zoneId, condition: rec.condition,
      status: rec.status, severity: rec.severity, action: rec.action, requiresVerification: rec.requiresVerification,
    });
    return res.status(201).json({ scan, zoneStatus: rec.status, recommendation: rec });
  } catch (e) {
    // Do not present an unverified prediction: mark failed and keep the error for review.
    scan.status = 'failed';
    scan.error = String(e.message).slice(0, 300);
    await scan.save();
    return res.status(502).json({ error: 'AI analysis failed', detail: scan.error, scan });
  }
};

exports.list = async (req, res) => {
  const filter = { ownerId: req.userId };
  if (req.query.fieldId && mongoose.isValidObjectId(req.query.fieldId)) filter.fieldId = req.query.fieldId;
  const scans = await Scan.find(filter).sort({ capturedAt: -1 }).limit(200).populate('fieldId', 'name');
  res.json({ scans });
};

async function ownedScan(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: 'Scan not found' }); return null; }
  const scan = await Scan.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!scan) { res.status(404).json({ error: 'Scan not found' }); return null; }
  return scan;
}

exports.get = async (req, res) => {
  const scan = await ownedScan(req, res);
  if (scan) res.json({ scan, recommendation: evaluateScan(scan) });
};

// Images are only served to their owner (the browser fetches them with the auth header).
exports.image = async (req, res) => {
  const scan = await ownedScan(req, res);
  if (!scan) return;
  if (!scan.imageUrl) return res.status(404).json({ error: 'No image for this scan' });
  const file = path.join(UPLOAD_DIR, path.basename(scan.imageUrl));
  res.type(path.extname(file) === '.png' ? 'image/png' : 'image/jpeg');
  res.set('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(file).on('error', () => res.status(404).end()).pipe(res);
};