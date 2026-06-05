const bcrypt = require('bcryptjs');

const hash = '$2a$10$BAo7QqyeQQR2putx21dZeevFCb1K3CSDHX.78eFS3pQeG3uOXeP9W';
const password = 'admin123';

bcrypt.compare(password, hash).then(isMatch => {
  console.log('Password match:', isMatch);
}).catch(err => {
  console.error('Error:', err);
});