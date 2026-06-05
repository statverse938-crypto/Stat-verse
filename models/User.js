const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  activationPin: {
    type: String,
    required: true,
  },
  examYear: {
    type: Number,
    required: true,
  },
  subjects: [{
    type: String,
    required: true,
  }],
  scoreHistory: [{
    subject: String,
    score: Number,
    totalQuestions: Number,
    date: {
      type: Date,
      default: Date.now,
    },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);