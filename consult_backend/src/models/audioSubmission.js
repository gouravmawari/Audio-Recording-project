const mongoose = require('mongoose');
 
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  storedFilename: { type: String, required: true },
  durationSeconds: { type: Number, required: true },
  sampleRateHz: { type: Number, required: true },
  bitrateBps: { type: Number, default: null },
  loudnessDb: { type: Number, required: true },
  submittedAt: { type: Date, default: Date.now },
});
 
module.exports = mongoose.model('AudioSubmission', schema);
 