const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');
const ActivationPin = require('../models/ActivationPin');
const Admin = require('../models/Admin');

// Helper function to read pins from JSON file
const getPinsFromFile = () => {
  try {
    const pinsPath = path.join(__dirname, '../pins.json');
    const data = fs.readFileSync(pinsPath, 'utf8');
    return JSON.parse(data).pins;
  } catch (err) {
    console.log('No pins.json file found, using database');
    return null;
  }
};

// Helper function to save pins to JSON file
const savePinsToFile = (pins) => {
  try {
    const pinsPath = path.join(__dirname, '../pins.json');
    fs.writeFileSync(pinsPath, JSON.stringify({ pins }, null, 2));
  } catch (err) {
    console.error('Error saving pins:', err);
  }
};

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

// Verify activation pin
exports.verifyPin = async (req, res) => {
  const { pinCode } = req.body;
  console.log('Verifying pin:', pinCode);
  
  try {
    // Try JSON file first for testing
    const pins = getPinsFromFile();
    console.log('Pins loaded:', pins ? pins.length : 'null');
    
    if (pins) {
      const pin = pins.find(p => p.pinCode.trim().toUpperCase() === pinCode.trim().toUpperCase());
      console.log('Pin found:', pin ? 'yes' : 'no');
      
      if (!pin) {
        console.log('Available pins:', pins.filter(p => p.status === 'unused').map(p => p.pinCode));
        return res.status(400).json({ message: 'Invalid activation pin' });
      }
      if (pin.status === 'used') {
        return res.status(400).json({ message: 'This pin has already been used' });
      }
      return res.json({ message: 'Pin is valid' });
    }

    // Fallback to database
    const pin = await ActivationPin.findOne({ pinCode });
    if (!pin) {
      return res.status(400).json({ message: 'Invalid activation pin' });
    }
    if (pin.status === 'used') {
      return res.status(400).json({ message: 'This pin has already been used' });
    }
    res.json({ message: 'Pin is valid' });
  } catch (err) {
    console.error('Verify pin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Register user
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, pinCode } = req.body;
  const examYear = req.body.examYear || new Date().getFullYear();
  const subjects = [];
  console.log('Registration attempt:', { name, email, examYear, pinCode });

  try {
    // Check if pin is valid and unused (try JSON file first)
    let pin = null;
    let pinIndex = -1;
    const pins = getPinsFromFile();

    if (pins) {
      pinIndex = pins.findIndex(p => p.pinCode.trim().toUpperCase() === pinCode.trim().toUpperCase());
      pin = pins[pinIndex];
    } else {
      // Fallback to database
      pin = await ActivationPin.findOne({ pinCode: new RegExp(`^${pinCode.trim()}$`, 'i') });
    }

    if (!pin || pin.status === 'used') {
      return res.status(400).json({ message: 'Invalid or used activation pin' });
    }

    // Check if user exists (try JSON file first)
    const users = getUsersFromFile();
    let existingUser = null;

    if (users) {
      existingUser = users.find(u => u.email === email);
    } else {
      existingUser = await User.findOne({ email });
    }

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Password hashed successfully');

    // Create user object
    const newUser = {
      _id: `user_${Date.now()}`,
      name,
      email,
      password: hashedPassword,
      activationPin: pinCode,
      examYear,
      subjects,
      createdAt: new Date().toISOString()
    };
    console.log('User object created:', { id: newUser._id, email: newUser.email });

    // Save user
    if (users) {
      // Save to JSON file
      console.log('Saving to JSON file...');
      users.push(newUser);
      saveUsersToFile(users);
      console.log('User saved to JSON file');
    } else {
      // Save to database
      console.log('Saving to database...');
      const user = new User(newUser);
      await user.save();
      newUser._id = user._id;
      console.log('User saved to database');
    }

    // Mark pin as used
    if (pins && pinIndex !== -1) {
      // Update JSON file
      console.log('Updating pin status in JSON...');
      pins[pinIndex].status = 'used';
      pins[pinIndex].usedBy = newUser._id.toString();
      pins[pinIndex].dateUsed = new Date().toISOString();
      savePinsToFile(pins);
      console.log('Pin updated in JSON file');
    } else {
      // Update database
      console.log('Updating pin status in database...');
      pin.status = 'used';
      pin.usedBy = user._id;
      pin.dateUsed = new Date();
      await pin.save();
      console.log('Pin updated in database');
    }

    // Registration successful; prompt user to login
    res.json({ message: 'Registration successful. Please login to continue.' });
  } catch (err) {
    console.error('Registration error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login
exports.login = async (req, res) => {
  const { email, password, pinCode } = req.body;

  try {
    // Try JSON file first
    const users = getUsersFromFile();
    let user = null;

    if (users) {
      user = users.find(u => u.email === email);
    } else {
      // Fallback to database
      user = await User.findOne({ email });
    }

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if pin code matches (case-insensitive and trimmed)
    if (user.activationPin.trim().toUpperCase() !== pinCode.trim().toUpperCase()) {
      return res.status(400).json({ message: 'Invalid activation pin' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const payload = { user: { id: user._id } };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    // Try JSON file first
    const users = getUsersFromFile();
    let user = null;

    if (users) {
      user = users.find(u => u._id === req.user.id);
    } else {
      // Fallback to database
      user = await User.findById(req.user.id).select('-password');
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  const { subjects } = req.body;
  console.log('updateProfile called for user', req.user?.id, 'with subjects:', subjects);

  try {
    // Try JSON file first
    const users = getUsersFromFile();
    
    if (users) {
      const userIndex = users.findIndex(u => u._id === req.user.id);
      if (userIndex === -1) {
        console.log('updateProfile: user not found in JSON');
        return res.status(404).json({ message: 'User not found' });
      }
      
      users[userIndex].subjects = subjects;
      saveUsersToFile(users);
      
      console.log('updateProfile: subjects saved to JSON for user', req.user.id);
      res.json({ message: 'Profile updated successfully', subjects });
    } else {
      // Fallback to database
      const user = await User.findById(req.user.id);
      if (!user) {
        console.log('updateProfile: user not found in DB');
        return res.status(404).json({ message: 'User not found' });
      }
      
      user.subjects = subjects;
      await user.save();
      
      console.log('updateProfile: subjects saved to DB for user', req.user.id);
      res.json({ message: 'Profile updated successfully', subjects });
    }
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin login
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Try to use database first
    if (mongoose.connection.readyState === 1) {
      let admin = await Admin.findOne({ email });
      if (!admin) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const payload = { user: { id: admin._id, role: 'admin' } };
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

      res.json({ token });
    } else {
      // Fallback to JSON file if MongoDB is not connected
      const adminsPath = path.join(__dirname, '../admins.json');
      let admins = [];
      try {
        const data = fs.readFileSync(adminsPath, 'utf8');
        admins = JSON.parse(data).admins;
      } catch (err) {
        console.log('No admins.json file found');
      }

      const admin = admins.find(a => a.email === email);
      if (!admin) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const payload = { user: { id: admin.id, role: 'admin' } };
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

      res.json({ token });
    }
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};