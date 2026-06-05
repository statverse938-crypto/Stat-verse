const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { auth } = require('../middleware/auth');

router.use(auth);

router.get('/questions', examController.getQuestions);
router.post('/submit', examController.submitExam);
router.get('/scores', examController.getUserScores);

module.exports = router;