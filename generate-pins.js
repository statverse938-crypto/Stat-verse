const fs = require('fs');
const path = require('path');

// Generate activation pins and save to JSON file
function generatePins(count = 50) {
  const pins = [];
  for (let i = 0; i < count; i++) {
    const pinCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    pins.push({
      pinCode,
      status: 'unused',
      usedBy: null,
      dateUsed: null,
      _id: `temp_${i}`
    });
  }

  const data = { pins };
  fs.writeFileSync(path.join(__dirname, 'pins.json'), JSON.stringify(data, null, 2));
  console.log(`Generated ${count} activation pins and saved to pins.json`);
  console.log('Sample pins:', pins.slice(0, 5).map(p => p.pinCode));
  return pins;
}

// If run directly, generate pins
if (require.main === module) {
  generatePins();
}

module.exports = { generatePins };