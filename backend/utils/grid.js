// Zone ids: row letter + 1-based column number, e.g. row 2, col 4 -> "B4".
function zoneIdFor(row, col) {
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

function parseZoneId(zoneId, rows, cols) {
  const m = /^([A-Z])(\d{1,2})$/.exec(String(zoneId || '').toUpperCase());
  if (!m) return null;
  const row = m[1].charCodeAt(0) - 65;
  const col = Number(m[2]) - 1;
  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
  return { row, col, zoneId: zoneIdFor(row, col) };
}

function allZones(rows, cols) {
  const zones = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) zones.push({ row: r, col: c, zoneId: zoneIdFor(r, c) });
  return zones;
}

module.exports = { zoneIdFor, parseZoneId, allZones };
