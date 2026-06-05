const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const ActivationPin = require('../models/ActivationPin');
const User = require('../models/User');
const Question = require('../models/Question');

const pinsFilePath = path.join(__dirname, '../pins.json');
const questionsFilePath = path.join(__dirname, '../questions.json');

// Helper: load pins from JSON fallback
const loadPinsFromJson = () => {
  try {
    const data = fs.readFileSync(pinsFilePath, 'utf8');
    return JSON.parse(data).pins || [];
  } catch (err) {
    return [];
  }
};

// Helper: save pins to JSON fallback
const savePinsToJson = (pins) => {
  fs.writeFileSync(pinsFilePath, JSON.stringify({ pins }, null, 2));
};

// Helper: load questions from JSON fallback
const loadQuestionsFromJson = () => {
  try {
    const data = fs.readFileSync(questionsFilePath, 'utf8');
    return JSON.parse(data).questions || [];
  } catch (err) {
    return [];
  }
};

// Helper: save questions to JSON fallback
const saveQuestionsToJson = (questions) => {
  fs.writeFileSync(questionsFilePath, JSON.stringify({ questions }, null, 2));
};

// Get dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const totalUsers = await User.countDocuments();
      const totalPins = await ActivationPin.countDocuments();
      const usedPins = await ActivationPin.countDocuments({ status: 'used' });
      const unusedPins = totalPins - usedPins;

      return res.json({ totalUsers, totalPins, usedPins, unusedPins });
    }

    // fallback if DB is not connected
    const pins = loadPinsFromJson();
    const totalPins = pins.length;
    const usedPins = pins.filter(pin => pin.status === 'used').length;
    const unusedPins = totalPins - usedPins;
    const totalUsers = 0;

    res.json({ totalUsers, totalPins, usedPins, unusedPins });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Generate activation pins
exports.generatePins = async (req, res) => {
  let { count } = req.body;

  // ✅ Validate count
  count = Number(count);

  if (!count || count < 1) {
    return res.status(400).json({ message: 'Invalid pin count' });
  }

  if (count > 200) {
    return res.status(400).json({ message: 'Maximum 200 pins allowed at once' });
  }

  // ✅ Helper to generate pin
  const generatePinCode = () =>
    Math.random().toString(36).substring(2, 10).toUpperCase();

  try {
    // ✅ If MongoDB is connected
    if (mongoose.connection.readyState === 1) {
      const batchSize = 50;

      for (let i = 0; i < count; i += batchSize) {
        const batch = [];

        for (let j = 0; j < batchSize && i + j < count; j++) {
          batch.push({
            pinCode: generatePinCode(),
            status: 'unused',
            usedBy: null,
            dateUsed: null,
          });
        }

        await ActivationPin.insertMany(batch);
      }

      return res.json({ message: `${count} pins generated successfully` });
    }

    // ✅ Fallback mode (JSON file)
    const existingPins = loadPinsFromJson();
    const newPins = [];

    for (let i = 0; i < count; i++) {
      newPins.push({
        pinCode: generatePinCode(),
        status: 'unused',
        usedBy: null,
        dateUsed: null,
      });
    }

    const mergedPins = existingPins.concat(newPins);
    savePinsToJson(mergedPins);

    return res.json({
      message: `${count} pins generated successfully (fallback file mode)`,
    });

  } catch (err) {
    console.error('Generate pins error:', err);
    return res.status(500).json({
      message: err.message || 'Server error while generating pins',
    });
  }
};

// Get all pins
exports.getAllPins = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const pins = await ActivationPin.find().populate('usedBy', 'name email');
      return res.json(pins);
    }

    const pins = loadPinsFromJson();
    res.json(pins);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Add question
exports.addQuestion = async (req, res) => {
  const { subject, question, optionA, optionB, optionC, optionD, correctAnswer, year } = req.body;

  try {
    if (mongoose.connection.readyState === 1) {
      const newQuestion = new Question({
        subject,
        question,
        optionA,
        optionB,
        optionC,
        optionD,
        correctAnswer,
        year,
      });

      await newQuestion.save();
      return res.json({ message: 'Question added successfully' });
    }

    // Fallback mode: save to questions.json
    const questions = loadQuestionsFromJson();
    const newQuestion = {
      _id: `question_${Date.now()}`,
      subject,
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      year,
    };

    questions.push(newQuestion);
    saveQuestionsToJson(questions);

    res.json({ message: 'Question added successfully (fallback file mode)' });
  } catch (err) {
    console.error('Add question error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all questions
exports.getAllQuestions = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const questions = await Question.find();
      return res.json(questions);
    }

    const questions = loadQuestionsFromJson();
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update question
exports.updateQuestion = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Question.findByIdAndUpdate(req.params.id, req.body);
      return res.json({ message: 'Question updated' });
    }

    // Fallback mode: update in questions.json
    const questions = loadQuestionsFromJson();
    const questionIndex = questions.findIndex(q => q._id === req.params.id);

    if (questionIndex === -1) {
      return res.status(404).json({ message: 'Question not found' });
    }

    questions[questionIndex] = { ...questions[questionIndex], ...req.body };
    saveQuestionsToJson(questions);

    res.json({ message: 'Question updated (fallback file mode)' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete question
exports.deleteQuestion = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Question.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Question deleted' });
    }

    // Fallback mode: delete from questions.json
    const questions = loadQuestionsFromJson();
    const questionIndex = questions.findIndex(q => q._id === req.params.id);

    if (questionIndex === -1) {
      return res.status(404).json({ message: 'Question not found' });
    }

    questions.splice(questionIndex, 1);
    saveQuestionsToJson(questions);

    res.json({ message: 'Question deleted (fallback file mode)' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Upload questions from CSV
exports.uploadQuestions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const csv = require('csv-parse/sync');
    const fileContent = req.file.buffer.toString('utf-8');
    const records = csv.parse(fileContent, {
      columns: ['subject', 'question', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer', 'year'],
      skip_empty_lines: true,
      from_line: 2 // Skip header
    });

    const questions = records.map(record => ({
      subject: record.subject,
      question: record.question,
      optionA: record.optionA,
      optionB: record.optionB,
      optionC: record.optionC,
      optionD: record.optionD,
      correctAnswer: record.correctAnswer,
      year: record.year
    }));

    await Question.insertMany(questions);
    res.json({ message: `${questions.length} questions uploaded successfully` });
  } catch (err) {
    res.status(500).json({ message: 'Error uploading questions: ' + err.message });
  }
};

// Upload lecture notes from JSON
exports.uploadLectureNotes = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const LectureNote = require('../models/LectureNote');
    const fileContent = req.file.buffer.toString('utf-8');
    const lectureNotes = JSON.parse(fileContent);

    // lectureNotes should be an array of {subject, topics: [...]}
    const notesArray = Array.isArray(lectureNotes) ? lectureNotes : [lectureNotes];
    
    for (const note of notesArray) {
      await LectureNote.updateOne(
        { subject: note.subject },
        { $set: { topics: note.topics } },
        { upsert: true }
      );
    }

    res.json({ message: `${notesArray.length} lecture note(s) uploaded successfully` });
  } catch (err) {
    res.status(500).json({ message: 'Error uploading lecture notes: ' + err.message });
  }
};