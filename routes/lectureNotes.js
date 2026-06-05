const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const lectureNotesController = require('../controllers/lectureNotesController');
const { auth } = require('../middleware/auth');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    // Create uploads directory if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Routes
router.get('/', auth, lectureNotesController.getAllNotes);
router.get('/subject/:subject', auth, lectureNotesController.getNotesBySubject);
router.post('/', auth, upload.array('images', 10), lectureNotesController.createNote);
router.put('/:id', auth, upload.array('images', 10), lectureNotesController.updateNote);
router.delete('/:id', auth, lectureNotesController.deleteNote);
router.delete('/:noteId/image/:imageIndex', auth, lectureNotesController.deleteNoteImage);

module.exports = router;