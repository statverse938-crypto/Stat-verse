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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  dateUsed: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('ActivationPin', activationPinSchema);