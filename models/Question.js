const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
  },
  question: {
    type: String,
    required: true,
  },
  optionA: {
    type: String,
    required: true,
  },
  optionB: {
    type: String,
    required: true,
  },
  optionC: {
    type: String,
    required: true,
  },
  optionD: {
    type: String,
    required: true,
  },
  correctAnswer: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C', 'D'],
  },
  year: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model('Question', questionSchema);