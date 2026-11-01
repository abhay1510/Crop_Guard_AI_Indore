const mongoose = require('mongoose');

const recSchema = new mongoose.Schema(
  {
    fieldId: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true, index: true },
    scanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scan', required: true },
    zoneId: { type: String, required: true },
    condition: String,
    status: String,
    severity: { type: String, enum: ['none', 'low', 'medium', 'high'] },
    action: String,
    requiresVerification: Boolean,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recommendation', recSchema);
