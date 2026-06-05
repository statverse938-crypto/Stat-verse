const bcrypt = require('bcryptjs');

bcrypt.hash('admin123', 10).then(hash => {
  console.log(hash);
  process.exit(0);
});
