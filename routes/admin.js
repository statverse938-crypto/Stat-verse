const express = require('express');
const multer = require('multer');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth, adminAuth } = require('../middleware/auth');

// Multer configuration for file uploads
const upload = multer({ storage: multer.memoryStorage() });

router.use(auth);
router.use(adminAuth);

router.get('/dashboard', adminController.getDashboardStats);
router.post('/pins/generate', adminController.generatePins);
router.get('/pins', adminController.getAllPins);
router.get('/users', adminController.getAllUsers);
router.delete('/users/:id', adminController.deleteUser);
router.post('/questions', adminController.addQuestion);
router.get('/questions', adminController.getAllQuestions);
router.put('/questions/:id', adminController.updateQuestion);
router.delete('/questions/:id', adminController.deleteQuestion);
router.post('/upload-questions', upload.single('file'), adminController.uploadQuestions);
router.post('/upload-lecture-notes', upload.single('file'), adminController.uploadLectureNotes);

module.exports = router;