const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const ActivationPin = require('./models/ActivationPin');

async function testPins() {
  try {
    // Start in-memory MongoDB
    const mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect to in-memory database
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to in-memory MongoDB');

    // Generate some test pins
    const pins = [];
    for (let i = 0; i < 5; i++) {
      const pinCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      pins.push({ pinCode });
    }

    await ActivationPin.insertMany(pins);
    console.log('Generated test pins:', pins.map(p => p.pinCode));

    // Retrieve one pin
    const pin = await ActivationPin.findOne({ status: 'unused' });
    console.log('Sample activation pin:', pin.pinCode);

    // Close connection
    await mongoose.connection.close();
    await mongoServer.stop();

  } catch (error) {
    console.error('Error:', error);
  }
}

testPins();