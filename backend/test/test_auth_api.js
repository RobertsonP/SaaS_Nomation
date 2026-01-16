const axios = require('axios');

(async () => {
  try {
    console.log('Testing Registration...');
    const regResponse = await axios.post('http://localhost:3002/auth/register', {
      name: 'Test User',
      email: 'newuser@test.com',
      password: 'password123'
    });
    console.log('Registration Success:', regResponse.data.user.email);

    console.log('Testing Login...');
    const loginResponse = await axios.post('http://localhost:3002/auth/login', {
      email: 'newuser@test.com',
      password: 'password123'
    });
    console.log('Login Success! Token received.');
  } catch (e) {
    console.error('API Test Failed:', e.response?.data || e.message);
  }
})();
