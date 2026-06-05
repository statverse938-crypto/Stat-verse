const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const Admin = require('./models/Admin');
const ActivationPin = require('./models/ActivationPin');
const Question = require('./models/Question');

dotenv.config();

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jamb-cbt', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Create admin
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = new Admin({
      email: 'admin@statscbt.com',
      password: adminPassword,
    });
    await admin.save();
    console.log('Admin created');

    // Generate activation pins
    const pins = [];
    for (let i = 0; i < 100; i++) {
      const pinCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      pins.push({ pinCode });
    }
    await ActivationPin.insertMany(pins);
    console.log('100 activation pins generated');

    // Sample questions for STAT 122 and STAT 112
    const questions = [
      {
        subject: 'STAT 122',
        question: 'What is the standard deviation?',
        optionA: 'The average of data points',
        optionB: 'The square root of variance',
        optionC: 'The range of data',
        optionD: 'The mode of data',
        correctAnswer: 'B',
        year: 2023,
      },
      {
        subject: 'STAT 122',
        question: 'What is the formula for mean?',
        optionA: 'Sum of all values divided by count',
        optionB: 'Middle value when sorted',
        optionC: 'Most frequent value',
        optionD: 'Maximum minus minimum',
        correctAnswer: 'A',
        year: 2023,
      },
      {
        subject: 'STAT 112',
        question: 'What does probability measure?',
        optionA: 'The frequency of events',
        optionB: 'The likelihood of an event occurring',
        optionC: 'The sample size',
        optionD: 'The data range',
        correctAnswer: 'B',
        year: 2023,
      },
      {
        subject: 'STAT 112',
        question: 'What is a histogram used for?',
        optionA: 'Showing relationships between variables',
        optionB: 'Displaying frequency distribution of data',
        optionC: 'Tracking changes over time',
        optionD: 'Comparing proportions',
        correctAnswer: 'B',
        year: 2023,
      },
      // Add more STAT 122 and STAT 112 questions as needed
    ];
    await Question.insertMany(questions);
    console.log('Sample questions added');

    console.log('Seeding completed');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedData();