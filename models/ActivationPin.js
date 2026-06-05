const mongoose = require('mongoose');

const activationPinSchema = new mongoose.Schema({
  pinCode: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['unused', 'used'],
    default: 'unused',
  },
  usedBy: {
    type: String,
    default: null,
  },
  dateUsed: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('ActivationPin', activationPinSchema);