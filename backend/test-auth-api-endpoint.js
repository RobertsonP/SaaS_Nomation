/**
 * Test the /api/auth-flows/test endpoint with our fixed UnifiedAuthService
 */
const axios = require('axios');

async function testAuthAPI() {
  console.log('🧪 Testing /api/auth-flows/test endpoint');
  console.log('==========================================');
  
  const testData = {
    loginUrl: 'https://tts.am/login',
    username: 'robert',
    password: 'CpanelAsdasd123+',
    steps: [
      {
        type: 'type',
        value: '${username}',
        selector: '#root  form > div:nth-child(1) > div > input',
        description: 'Enter username'
      },
      {
        type: 'type',
        value: '${password}',
        selector: '#root  form > div:nth-child(2) > div > input',
        description: 'Enter password'
      },
      {
        type: 'click',
        selector: '#root  form > button',
        description: 'Click login button'
      }
    ]
  };
  
  try {
    console.log('🌐 Making POST request to auth test endpoint...');
    
    const response = await axios.post('http://localhost:3002/api/auth-flows/test', testData, {
      timeout: 60000, // 60 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API Response received:');
    console.log('Status:', response.status);
    console.log('Success:', response.data.success);
    console.log('Message:', response.data.message);
    console.log('Final URL:', response.data.details?.finalUrl);
    
    if (response.data.details) {
      console.log('Steps Completed:', response.data.details.stepsCompleted);
      console.log('Total Steps:', response.data.details.totalSteps);
    }
    
    if (response.data.suggestions) {
      console.log('Suggestions:', response.data.suggestions);
    }
    
    if (response.data.success) {
      console.log('🎉 AUTH API TEST SUCCESSFUL!');
    } else {
      console.log('❌ Auth test failed via API');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Backend server not running. Start with: npm run dev');
    } else if (error.response) {
      console.log('❌ API Error Response:');
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('❌ Request failed:', error.message);
    }
  }
}

testAuthAPI().catch(console.error);