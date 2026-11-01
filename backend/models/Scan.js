const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema(
  {
    fieldId: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    imageUrl: { type: String },
    zoneId: { type: String, required: true }, // e.g. "B4"
    // Optional real GPS (GeoJSON, [lng, lat]). Left unset in the grid-only MVP.
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    prediction: String,
    confidence: Number,
    certainty: { type: String, enum: ['high', 'medium', 'low'] },
    modelVersion: String,
    cropMismatch: { type: Boolean, default: false }, // predicted crop != field crop
    topPredictions: [{ _id: false, class: String, score: Number }],
    error: String,
    capturedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

scanSchema.index({ fieldId: 1, zoneId: 1, capturedAt: -1 });

module.exports = mongoose.model('Scan', scanSchema);