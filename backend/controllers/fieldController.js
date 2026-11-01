const mongoose = require('mongoose');
const Field = require('../models/Field');
const Scan = require('../models/Scan');
const Recommendation = require('../models/Recommendation');
const { allZones } = require('../utils/grid');
const { buildHealthMap, summarize } = require('../services/recommendations');
const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

/** Load a field only if it belongs to the requesting user (404 otherwise, to avoid leaking existence). */
async function getOwnedField(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) { res.status(404).json({ error: 'Field not found' }); return null; }
  const field = await Field.findOne({ _id: id, ownerId: req.userId });
  if (!field) { res.status(404).json({ error: 'Field not found' }); return null; }
  return field;
}

function parseFieldBody(b, partial = false) {
  const out = {};
  const bad = (m) => { throw Object.assign(new Error(m), { status: 400 }); };
  const num = (v) => (typeof v === 'number' ? v : Number(v));
  if (!partial || b.name !== undefined) {
    if (typeof b.name !== 'string' || !b.name.trim()) bad('Field name is required');
    out.name = b.name.trim().slice(0, 100);
  }
  if (!partial || b.cropType !== undefined) {
    if (typeof b.cropType !== 'string' || !b.cropType.trim()) bad('Crop type is required');
    out.cropType = b.cropType.trim().toLowerCase().slice(0, 50);
  }
  if (!partial || b.areaAcres !== undefined) {
    const v = num(b.areaAcres);
    if (!Number.isFinite(v) || v <= 0) bad('Area (acres) must be a positive number');
    out.areaAcres = v;
  }
  for (const [key, max] of [['gridRows', 26], ['gridColumns', 30]]) {
    if (!partial || b[key] !== undefined) {
      const v = num(b[key]);
      if (!Number.isInteger(v) || v < 1 || v > max) bad(`${key} must be an integer between 1 and ${max}`);
      out[key] = v;
    }
  }
  return out;
}

exports.getOwnedField = getOwnedField;

exports.create = async (req, res) => {
  const data = parseFieldBody(req.body || {});
  const field = await Field.create({ ...data, ownerId: req.userId });
  res.status(201).json({ field });
};

exports.list = async (req, res) => {
  const fields = await Field.find({ ownerId: req.userId }).sort({ createdAt: -1 }).lean();
  const counts = await Scan.aggregate([
    { $match: { ownerId: new mongoose.Types.ObjectId(req.userId) } },
    { $group: { _id: '$fieldId', n: { $sum: 1 } } },
  ]);
  const byField = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ fields: fields.map((f) => ({ ...f, scanCount: byField.get(String(f._id)) || 0 })) });
};

exports.get = async (req, res) => {
  const field = await getOwnedField(req, res);
  if (field) res.json({ field });
};

exports.update = async (req, res) => {
  const field = await getOwnedField(req, res);
  if (!field) return;
  const data = parseFieldBody(req.body || {}, true);
  // Shrinking the grid could orphan existing scans, so block it once scans exist.
  if ((data.gridRows && data.gridRows < field.gridRows) || (data.gridColumns && data.gridColumns < field.gridColumns)) {
    if (await Scan.exists({ fieldId: field._id })) return res.status(409).json({ error: 'Cannot shrink the grid of a field that already has scans' });
  }
  Object.assign(field, data);
  await field.save();
  res.json({ field });
};

async function removeScanImages(scans) {
  await Promise.all(scans.filter((scan) => scan.imageUrl).map((scan) => fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(scan.imageUrl))).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  })));
}

async function deleteFieldAnalysis(fieldId, scans) {
  await removeScanImages(scans);
  const scanIds = scans.map((scan) => scan._id);
  const recommendationFilter = scanIds.length
    ? { $or: [{ fieldId }, { scanId: { $in: scanIds } }] }
    : { fieldId };
  const [deletedRecommendations, deletedScans] = await Promise.all([
    Recommendation.deleteMany(recommendationFilter),
    Scan.deleteMany({ fieldId }),
  ]);
  return {
    deletedScans: deletedScans.deletedCount,
    deletedRecommendations: deletedRecommendations.deletedCount,
  };
}

exports.remove = async (req, res) => {
  const field = await getOwnedField(req, res);
  if (!field) return;
  const scans = await Scan.find({ fieldId: field._id }, 'imageUrl');
  await deleteFieldAnalysis(field._id, scans);
  await field.deleteOne();
  res.json({ ok: true });
};

exports.resetAnalysis = async (req, res) => {
  const field = await getOwnedField(req, res);
  if (!field) return;
  await Field.updateOne({ _id: field._id, ownerId: req.userId }, { $inc: { analysisVersion: 1 } });
  const scans = await Scan.find({ fieldId: field._id }, 'imageUrl');
  const deleted = await deleteFieldAnalysis(field._id, scans);
  res.json({ ok: true, ...deleted });
};

async function mapFor(field) {
  const scans = await Scan.find({ fieldId: field._id }).lean();
  const zones = buildHealthMap(field, scans, allZones(field.gridRows, field.gridColumns));
  return { zones, summary: summarize(field, zones) };
}

exports.healthMap = async (req, res) => {
  const field = await getOwnedField(req, res);
  if (!field) return;
  const { zones, summary } = await mapFor(field);
  res.json({ field, zones, summary });
};

exports.recommendations = async (req, res) => {
  const field = await getOwnedField(req, res);
  if (!field) return;
  const { zones } = await mapFor(field);
  const order = { high: 0, medium: 1, low: 2, none: 3 };
  const items = zones
    .filter((z) => z.recommendation && z.status !== 'healthy')
    .map((z) => ({
      zoneId: z.zoneId, status: z.status, conflict: z.conflict, scanId: z.latestScan?.id,
      confidence: z.latestScan?.confidence, capturedAt: z.latestScan?.capturedAt, ...z.recommendation,
    }))
    .sort((a, b) => order[a.severity] - order[b.severity]);
  res.json({ recommendations: items });
};

exports.statistics = async (req, res) => {
  const field = await getOwnedField(req, res);
  if (!field) return;
  const { summary } = await mapFor(field);
  const totalScans = await Scan.countDocuments({ fieldId: field._id });
  res.json({ summary: { ...summary, totalScans } });
};

exports.scans = async (req, res) => {
  const field = await getOwnedField(req, res);
  if (!field) return;
  const scans = await Scan.find({ fieldId: field._id }).sort({ capturedAt: -1 }).limit(200);
  res.json({ scans });
};

/** Dashboard stats across all of the user's fields, computed from stored data only. */
exports.dashboard = async (req, res) => {
  const fields = await Field.find({ ownerId: req.userId });
  const totals = { healthy: 0, possible_stress: 0, suspected_disease: 0, unknown: 0, not_inspected: 0 };
  let flaggedAreaAcres = 0;
  const perField = [];
  for (const f of fields) {
    const { summary } = await mapFor(f);
    Object.keys(totals).forEach((k) => { totals[k] += summary.counts[k]; });
    flaggedAreaAcres += summary.flaggedAreaAcres;
    perField.push({ id: f._id, name: f.name, cropType: f.cropType, counts: summary.counts, flaggedAreaAcres: summary.flaggedAreaAcres });
  }
  const totalScans = await Scan.countDocuments({ ownerId: req.userId });
  const recent = await Scan.find({ ownerId: req.userId }).sort({ capturedAt: -1 }).limit(6).populate('fieldId', 'name');
  res.json({
    totalFields: fields.length,
    totalScans,
    zoneCounts: totals,
    flaggedAreaAcres: Number(flaggedAreaAcres.toFixed(3)),
    perField,
    recentScans: recent.map((s) => ({
      id: s._id, fieldId: s.fieldId?._id, fieldName: s.fieldId?.name, zoneId: s.zoneId, status: s.status,
      prediction: s.prediction, confidence: s.confidence, certainty: s.certainty, capturedAt: s.capturedAt,
    })),
  });
};

/** Printable field report data. Everything is computed from stored scans. */
exports.report = async (req, res) => {
  const field = await getOwnedField(req, res);
  if (!field) return;
  const { zones, summary } = await mapFor(field);
  const totalScans = await Scan.countDocuments({ fieldId: field._id });
  const order = { high: 0, medium: 1, low: 2, none: 3 };
  const actions = zones
    .filter((z) => z.recommendation && z.status !== 'healthy')
    .map((z) => ({ zoneId: z.zoneId, status: z.status, conflict: z.conflict, confidence: z.latestScan?.confidence, capturedAt: z.latestScan?.capturedAt, ...z.recommendation }))
    .sort((a, b) => order[a.severity] - order[b.severity]);
  res.json({
    generatedAt: new Date().toISOString(),
    field, summary: { ...summary, totalScans }, zones, actions,
    disclaimer: 'AI predictions are screening aids, not diagnoses. Verify on-site and consult local agronomic guidance before any treatment.',
  });
};