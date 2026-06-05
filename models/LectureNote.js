const mongoose = require('mongoose');

const lectureNoteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  images: [{
    filename: String,
    originalName: String,
    path: String,
    mimetype: String,
    size: Number,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  subject: {
    type: String,
    required: true,
    enum: ['STAT 122', 'STAT 112']
  },
  createdBy: {
    type: String,
    required: true // admin email
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('LectureNote', lectureNoteSchema);