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

// Helper: load users from JSON fallback
const loadUsersFromJson = () => {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../users.json'), 'utf8');
    return JSON.parse(data).users || [];
  } catch (err) {
    return [];
  }
};

// Helper: save users to JSON fallback
const saveUsersToJson = (users) => {
  fs.writeFileSync(path.join(__dirname, '../users.json'), JSON.stringify({ users }, null, 2));
};

// Get dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const totalUsers = await User.countDocuments({ deleted: { $ne: true } });
      const totalPins = await ActivationPin.countDocuments();
      const usedPins = await ActivationPin.countDocuments({ status: 'used' });
      const unusedPins = totalPins - usedPins;
      const totalQuestions = await Question.countDocuments();

      return res.json({ totalUsers, totalPins, usedPins, unusedPins, totalQuestions });
    }

    // fallback if DB is not connected
    const pins = loadPinsFromJson();
    const totalPins = pins.length;
    const usedPins = pins.filter(pin => pin.status === 'used').length;
    const unusedPins = totalPins - usedPins;
    const users = loadUsersFromJson();
    const totalUsers = users ? users.filter(u => !u.deleted).length : 0;
    const totalQuestions = loadQuestionsFromJson().length;

    res.json({ totalUsers, totalPins, usedPins, unusedPins, totalQuestions });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

// Generate activation pins
exports.generatePins = async (req, res) => {
  let { count } = req.body;

  // Validate count
  count = Number(count);

  if (!count || count < 1) {
    return res.status(400).json({ message: 'Invalid pin count' });
  }

  if (count > 2000) {
    return res.status(400).json({ message: 'Maximum 2000 pins allowed at once' });
  }

  // Helper to generate pin
  const generatePinCode = () =>
    Math.random().toString(36).substring(2, 10).toUpperCase();

  try {
    // If MongoDB is connected - ensure uniqueness and return generated pins
    if (mongoose.connection.readyState === 1) {
      // Load existing pin codes to avoid duplicates
      const existing = await ActivationPin.find().select('pinCode');
      const existingSet = new Set(existing.map(p => p.pinCode));
      const generated = [];
      const generatedSet = new Set();
      const maxAttempts = count * 10; // Prevent infinite loop
      let attempts = 0;

      while (generated.length < count && attempts < maxAttempts) {
        const candidate = generatePinCode();
        if (!existingSet.has(candidate) && !generatedSet.has(candidate)) {
          existingSet.add(candidate);
          generatedSet.add(candidate);
          generated.push({ pinCode: candidate, status: 'unused', usedBy: null, dateUsed: null });
        }
        attempts++;
      }

      if (generated.length < count) {
        return res.status(400).json({ message: `Could only generate ${generated.length} unique pins out of ${count} requested` });
      }

      // Insert in batches to avoid large single insert
      const batchSize = 100;
      for (let i = 0; i < generated.length; i += batchSize) {
        const slice = generated.slice(i, i + batchSize);
        await ActivationPin.insertMany(slice, { ordered: false }).catch(err => {
          // Ignore duplicate key errors during batch insert
          if (err.code !== 11000) throw err;
        });
      }

      // Return the raw codes so admin can distribute them immediately
      return res.json({ message: `${count} pins generated successfully`, pins: generated.map(p => p.pinCode) });
    }

    // Fallback mode (JSON file)
    const existingPins = loadPinsFromJson();
    const existingSet = new Set(existingPins.map(p => p.pinCode));
    const newPins = [];
    const newSet = new Set();
    const maxAttempts = count * 10;
    let attempts = 0;

    while (newPins.length < count && attempts < maxAttempts) {
      const candidate = generatePinCode();
      if (!existingSet.has(candidate) && !newSet.has(candidate)) {
        existingSet.add(candidate);
        newSet.add(candidate);
        newPins.push({ pinCode: candidate, status: 'unused', usedBy: null, dateUsed: null });
      }
      attempts++;
    }

    if (newPins.length < count) {
      return res.status(400).json({ message: `Could only generate ${newPins.length} unique pins out of ${count} requested` });
    }

    const mergedPins = existingPins.concat(newPins);
    savePinsToJson(mergedPins);

    return res.json({ message: `${count} pins generated successfully (fallback file mode)`, pins: newPins.map(p => p.pinCode) });

  } catch (err) {
    console.error('Generate pins error:', err);
    return res.status(500).json({ message: err.message || 'Server error while generating pins' });
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
    const users = loadUsersFromJson();
    const enrichedPins = pins.map(pin => {
      if (pin.usedBy && users) {
        const user = users.find(u => u._id === pin.usedBy);
        if (user) {
          return { ...pin, usedBy: { _id: user._id, name: user.name, email: user.email } };
        }
      }
      return pin;
    });

    res.json(enrichedPins);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const users = await User.find({ deleted: { $ne: true } }).select('-password');
      return res.json(users);
    }

    const users = loadUsersFromJson();
    res.json(users ? users.filter(u => !u.deleted) : []);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete user (soft delete to block future login/signup)
exports.deleteUser = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      user.deleted = true;
      await user.save();
      return res.json({ message: 'User deleted' });
    }

    const users = loadUsersFromJson();
    const userIndex = users.findIndex(u => u._id === req.params.id);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    users[userIndex].deleted = true;
    saveUsersToJson(users);
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