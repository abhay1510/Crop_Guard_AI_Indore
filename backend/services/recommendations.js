// Transparent, rules-based layer. Statuses: healthy | possible_stress | suspected_disease | unknown | not_inspected
// It deliberately never recommends pesticide/fertiliser products or doses: a classifier alone cannot justify them.

const pretty = (s) => String(s || '').replace(/_/g, ' ');

function isHealthy(cls) {
  return /healthy/i.test(cls || '');
}

/** Map one scan to a zone status + recommendation. */
function evaluateScan(scan) {
  if (!scan || scan.status !== 'completed' || !scan.prediction) {
    return {
      status: 'unknown',
      severity: 'low',
      condition: null,
      action: 'Scan failed or incomplete. Upload the image again or inspect this zone manually.',
      requiresVerification: true,
    };
  }
  const label = pretty(scan.prediction);

  if (scan.cropMismatch) {
    return {
      status: 'unknown',
      severity: 'low',
      condition: label,
      action: `The model recognised this as "${label}", which does not match this field's crop. Retake a close-up of a single leaf of the field crop, or inspect manually.`,
      requiresVerification: true,
    };
  }

  if (scan.certainty === 'low') {
    return {
      status: 'unknown',
      severity: 'low',
      condition: label,
      action: `Result is uncertain. Retake a clearer close-up image or inspect manually.`,
      requiresVerification: true,
    };
  }
  if (isHealthy(scan.prediction)) {
    if (scan.certainty === 'high') {
      return {
        status: 'healthy',
        severity: 'none',
        condition: 'healthy',
        action: `No problem detected. Continue routine monitoring.`,
        requiresVerification: false,
      };
    }
    return {
      status: 'possible_stress',
      severity: 'low',
      condition: 'healthy (moderate confidence)',
      action: `Moderate confidence. Take another image or do a quick visual check.`,
      requiresVerification: true,
    };
  }
  // Non-healthy class
  if (scan.certainty === 'high') {
    return {
      status: 'suspected_disease',
      severity: 'high',
      condition: label,
      action: `Suspected "${label}". Verify symptoms on-site and consult crop-specific agronomic guidance before any treatment.`,
      requiresVerification: true,
    };
  }
  return {
    status: 'possible_stress',
    severity: 'medium',
    condition: label,
    action: `Possible "${label}" (moderate confidence). Inspect plants in this zone and take more images.`,
    requiresVerification: true,
  };
}

/**
 * Build the health map from scans: latest completed scan per zone is displayed,
 * earlier scans are kept as history and conflicting statuses are flagged for review.
 */
function buildHealthMap(field, scans, zones) {
  const byZone = new Map();
  for (const s of scans) {
    if (!byZone.has(s.zoneId)) byZone.set(s.zoneId, []);
    byZone.get(s.zoneId).push(s);
  }
  return zones.map(({ row, col, zoneId }) => {
    const list = (byZone.get(zoneId) || []).sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
    const completed = list.filter((s) => s.status === 'completed');
    const latest = completed[0] || null;
    if (!latest) {
      return { zoneId, row, col, status: 'not_inspected', scanCount: list.length, conflict: false, latestScan: null, recommendation: null };
    }
    const rec = evaluateScan(latest);
    const prev = completed[1] ? evaluateScan(completed[1]).status : null;
    return {
      zoneId, row, col,
      status: rec.status,
      scanCount: list.length,
      conflict: prev !== null && prev !== rec.status,
      latestScan: {
        id: latest._id, prediction: latest.prediction, confidence: latest.confidence,
        certainty: latest.certainty, modelVersion: latest.modelVersion,
        capturedAt: latest.capturedAt,
      },
      recommendation: rec,
    };
  });
}

function summarize(field, zones) {
  const counts = { healthy: 0, possible_stress: 0, suspected_disease: 0, unknown: 0, not_inspected: 0 };
  zones.forEach((z) => { counts[z.status] += 1; });
  const total = zones.length;
  const flagged = counts.possible_stress + counts.suspected_disease;
  const areaPerCell = field.areaAcres / total;
  return {
    totalZones: total,
    counts,
    inspectedZones: total - counts.not_inspected,
    flaggedZones: flagged,
    areaPerCellAcres: Number(areaPerCell.toFixed(4)),
    flaggedAreaAcres: Number((flagged * areaPerCell).toFixed(3)),
    note: 'Flagged area means area marked for inspection, not area that must be treated.',
  };
}

module.exports = { evaluateScan, buildHealthMap, summarize };