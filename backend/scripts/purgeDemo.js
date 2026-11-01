// One-off: delete simulated/demo scans and their recommendations left in MongoDB by the old version.
// Usage (from backend/):  node scripts/purgeDemo.js
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cropguard');
  const scans = mongoose.connection.collection('scans');
  const recs = mongoose.connection.collection('recommendations');
  const filter = { $or: [{ demo: true }, { modelVersion: 'demo-seed' }] };
  const ids = (await scans.find(filter, { projection: { _id: 1 } }).toArray()).map((s) => s._id);
  const r1 = ids.length ? await recs.deleteMany({ scanId: { $in: ids } }) : { deletedCount: 0 };
  const r2 = await scans.deleteMany(filter);
  console.log(`Deleted ${r2.deletedCount} demo scans and ${r1.deletedCount} recommendations.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });