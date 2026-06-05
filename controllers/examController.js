const Question = require('../models/Question');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// Helper function to read users from JSON file
const getUsersFromFile = () => {
  try {
    const usersPath = path.join(__dirname, '../users.json');
    const data = fs.readFileSync(usersPath, 'utf8');
    return JSON.parse(data).users || [];
  } catch (err) {
    console.log('No users.json file found, using database');
    return null;
  }
};

// Helper function to save users to JSON file
const saveUsersToFile = (users) => {
  try {
    const usersPath = path.join(__dirname, '../users.json');
    fs.writeFileSync(usersPath, JSON.stringify({ users }, null, 2));
  } catch (err) {
    console.error('Error saving users:', err);
  }
};

// Helper function to read questions from JSON file
const getQuestionsFromFile = () => {
  try {
    const questionsPath = path.join(__dirname, '../questions.json');
    const data = fs.readFileSync(questionsPath, 'utf8');
    return JSON.parse(data).questions || [];
  } catch (err) {
    console.log('No questions.json file found, using database');
    return null;
  }
};

// Get questions for exam
exports.getQuestions = async (req, res) => {
  const { subject } = req.query;
  try {
    // Try JSON file first
    const allQuestions = getQuestionsFromFile();
    if (allQuestions) {
      const questions = allQuestions.filter(q => q.subject === subject).slice(0, 50);
      return res.json(questions);
    }

    // Fallback to database
    const questions = await Question.find({ subject }).limit(50);
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Submit exam
exports.submitExam = async (req, res) => {
  console.log('Backend: Submit exam called');
  console.log('Backend: Request body:', req.body);
  console.log('Backend: User ID:', req.user?.id);
  
  const { answers, subject } = req.body;
  const userId = req.user.id;

  try {
    // Try JSON file first for questions
    let questions = getQuestionsFromFile();
    if (questions) {
      questions = questions.filter(q => q.subject === subject);
      console.log('Backend: Found', questions.length, 'questions from JSON for subject:', subject);
    } else {
      // Fallback to database
      questions = await Question.find({ subject });
      console.log('Backend: Found', questions.length, 'questions from database for subject:', subject);
    }

    let correct = 0;

    questions.forEach((q, index) => {
      if (answers[index] === q.correctAnswer) {
        correct++;
      }
    });

    console.log('Backend: Correct answers:', correct, 'out of', questions.length);

    const score = (correct / questions.length) * 100;
    
    // Store detailed exam information - convert optionA/B/C/D to array
    const examDetails = questions.map((q, index) => {
      // Handle both formats: array or A/B/C/D
      let optionsArray = [];
      if (Array.isArray(q.options)) {
        optionsArray = q.options;
      } else {
        optionsArray = [q.optionA, q.optionB, q.optionC, q.optionD].filter(opt => opt);
      }
      
      // Convert letter answer to index for consistency
      const userAnswerIndex = answers[index] === 'A' ? 0 : answers[index] === 'B' ? 1 : answers[index] === 'C' ? 2 : answers[index] === 'D' ? 3 : null;
      const correctAnswerIndex = q.correctAnswer === 'A' ? 0 : q.correctAnswer === 'B' ? 1 : q.correctAnswer === 'C' ? 2 : q.correctAnswer === 'D' ? 3 : q.correctAnswer;
      
      return {
        question: q.question,
        options: optionsArray,
        correctAnswer: correctAnswerIndex,
        userAnswer: userAnswerIndex,
        isCorrect: answers[index] === q.correctAnswer
      };
    });
    
    const scoreEntry = {
      subject,
      score,
      totalQuestions: questions.length,
      date: new Date().toISOString(),
      examDetails: examDetails
    };

    console.log('Backend: Calculated score:', score);

    // Try JSON file first
    const users = getUsersFromFile();
    if (users) {
      const userIndex = users.findIndex(u => u._id === userId);
      if (userIndex !== -1) {
        if (!users[userIndex].scoreHistory) {
          users[userIndex].scoreHistory = [];
        }
        users[userIndex].scoreHistory.push(scoreEntry);
        saveUsersToFile(users);
        console.log('Backend: Saved score to JSON file');
        res.json({
          score,
          correct,
          total: questions.length,
        });
        return;
      }
    }

    // Fallback to database
    await User.findByIdAndUpdate(userId, {
      $push: {
        scoreHistory: scoreEntry,
      },
    });

    console.log('Backend: Saved score to database');
    res.json({
      score,
      correct,
      total: questions.length,
    });
  } catch (err) {
    console.error('Backend: Submit exam error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user scores
exports.getUserScores = async (req, res) => {
  try {
    console.log('Getting scores for user:', req.user.id);
    // Try JSON file first
    const users = getUsersFromFile();
    if (users) {
      console.log('Found users in JSON:', users.length);
      const user = users.find(u => u._id === req.user.id);
      console.log('Found user:', user ? 'yes' : 'no');
      if (user) {
        console.log('User scoreHistory:', user.scoreHistory);
        res.json(user.scoreHistory || []);
        return;
      }
    }

    // Fallback to database
    console.log('Falling back to database');
    const user = await User.findById(req.user.id).select('scoreHistory');
    res.json(user.scoreHistory);
  } catch (err) {
    console.error('getUserScores error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};