const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    cropType: { type: String, required: true, trim: true, lowercase: true, maxlength: 50 },
    areaAcres: { type: Number, required: true, min: 0.01 },
    gridRows: { type: Number, required: true, min: 1, max: 26 },
    gridColumns: { type: Number, required: true, min: 1, max: 30 },
    boundary: { type: Object, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Field', fieldSchema);
