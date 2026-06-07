const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files for uploaded images
app.use('/uploads', express.static('uploads'));

// Database connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/jamb-cbt';
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.log('MongoDB connection error:', err.message);
  console.log('Server will continue running with fallback storage');
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/exam', require('./routes/exam'));
app.use('/api/lecture-notes', require('./routes/lectureNotes'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint for debugging
app.get('/test', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    let dbTest = null;
    
    if (dbStatus === 'connected') {
      // Try a simple query
      const User = require('./models/User');
      const count = await User.countDocuments().exec();
      dbTest = { status: 'ok', userCount: count };
    }
    
    res.json({ 
      status: 'ok', 
      mongodb: dbStatus,
      dbTest,
      nodeEnv: process.env.NODE_ENV || 'not-set',
      hasMongoUri: !!process.env.MONGODB_URI,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ 
      error: err.message,
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});