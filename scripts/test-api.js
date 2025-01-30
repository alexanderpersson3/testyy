const axios = require('axios');
const colors = require('colors');
const ora = require('ora');

const PLATFORMS = {
  WEB: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  },
  FLUTTER: {
    userAgent: 'Rezepta-Flutter/1.0'
  },
  SCRAPER: {
    userAgent: 'Rezepta-Scraper/1.0'
  }
};

class APITester {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };
    this.errors = [];
  }

  async testEndpoint(endpoint, method, data = null, auth = null, platform) {
    const spinner = ora(`Testing ${method} ${endpoint} for ${platform}`).start();

    try {
      this.results.total++;

      const headers = {
        'User-Agent': PLATFORMS[platform].userAgent,
        'Content-Type': 'application/json'
      };

      if (auth) {
        headers['Authorization'] = `Bearer ${auth}`;
      }

      const response = await axios({
        method,
        url: `${this.baseURL}${endpoint}`,
        data,
        headers,
        validateStatus: false
      });

      // Check response structure
      const isValid = this.validateResponse(response);

      if (isValid) {
        spinner.succeed(`${method} ${endpoint} - ${platform} - OK`);
        this.results.passed++;
      } else {
        spinner.fail(`${method} ${endpoint} - ${platform} - Invalid Response Structure`);
        this.results.failed++;
        this.errors.push({
          endpoint,
          method,
          platform,
          error: 'Invalid response structure',
          response: response.data
        });
      }

      return response;
    } catch (error) {
      spinner.fail(`${method} ${endpoint} - ${platform} - Error`);
      this.results.failed++;
      this.errors.push({
        endpoint,
        method,
        platform,
        error: error.message
      });
    }
  }

  validateResponse(response) {
    // Basic validation
    if (!response || !response.data) return false;

    // Check for proper error structure
    if (response.status >= 400) {
      return response.data.hasOwnProperty('error');
    }

    // Check for common response properties
    if (response.status === 200 || response.status === 201) {
      return true;
    }

    return false;
  }

  printResults() {
    console.log('\n=== Test Results ==='.bold);
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`.green);
    console.log(`Failed: ${this.results.failed}`.red);
    console.log(`Skipped: ${this.results.skipped}`.yellow);

    if (this.errors.length > 0) {
      console.log('\n=== Errors ==='.red);
      this.errors.forEach((error, index) => {
        console.log(`\n${index + 1}. ${error.method} ${error.endpoint} (${error.platform})`.red);
        console.log(`   Error: ${error.error}`);
        if (error.response) {
          console.log('   Response:', error.response);
        }
      });
    }
  }
}

async function runTests() {
  const tester = new APITester();
  let testUser;

  console.log('\n=== Starting API Tests ===\n'.bold);

  // Test each endpoint for each platform
  for (const platform of Object.keys(PLATFORMS)) {
    console.log(`\n=== Testing ${platform} Platform ===\n`.cyan);

    // Authentication
    const registerResponse = await tester.testEndpoint(
      '/api/auth/register',
      'POST',
      {
        email: `test_${Date.now()}@example.com`,
        username: `test_${Date.now()}`,
        password: 'Test123!'
      },
      null,
      platform
    );

    if (registerResponse && registerResponse.data.token) {
      testUser = {
        token: registerResponse.data.token,
        userId: registerResponse.data.user._id
      };

      // Test authenticated endpoints
      await tester.testEndpoint('/api/users/me', 'GET', null, testUser.token, platform);
      
      // Create recipe
      const recipeResponse = await tester.testEndpoint(
        '/api/recipes',
        'POST',
        {
          title: 'Test Recipe',
          description: 'Test description',
          ingredients: [{ name: 'Test Ingredient', amount: 1, unit: 'cup' }],
          instructions: ['Step 1']
        },
        testUser.token,
        platform
      );

      if (recipeResponse && recipeResponse.data._id) {
        // Test recipe-related endpoints
        await tester.testEndpoint(`/api/recipes/${recipeResponse.data._id}`, 'GET', null, testUser.token, platform);
        await tester.testEndpoint(`/api/recipes/${recipeResponse.data._id}/like`, 'POST', null, testUser.token, platform);
        await tester.testEndpoint(`/api/recipes/${recipeResponse.data._id}/comments`, 'POST', { text: 'Test comment' }, testUser.token, platform);
      }

      // Test search
      await tester.testEndpoint('/api/search/recipes', 'GET', null, testUser.token, platform);
      await tester.testEndpoint('/api/search/users', 'GET', null, testUser.token, platform);

      // Test notifications
      await tester.testEndpoint('/api/notifications', 'GET', null, testUser.token, platform);

      // Test price tracking
      await tester.testEndpoint('/api/price-alerts', 'GET', null, testUser.token, platform);
    }

    // Test public endpoints
    await tester.testEndpoint('/api/recipes', 'GET', null, null, platform);
    await tester.testEndpoint('/api/recipes/featured', 'GET', null, null, platform);
    await tester.testEndpoint('/api/ingredients', 'GET', null, null, platform);
  }

  tester.printResults();
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { APITester, runTests }; 