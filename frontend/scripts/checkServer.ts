import { checkServerStatus } from '../src/utils/checkServerStatus';

async function checkServer() {
  console.log('Checking backend server status...\n');
  
  try {
    const checks = {
      http: false,
      websocket: false,
      recipe: false
    };

    // Check HTTP
    try {
      const res = await fetch('http://localhost:3001/health');
      checks.http = res.status === 200;
    } catch (e) {
      console.log('❌ HTTP API is not available');
    }

    // Check WebSocket
    try {
      const ws = new WebSocket('ws://localhost:3001');
      await new Promise((resolve) => {
        ws.onopen = () => {
          checks.websocket = true;
          ws.close();
          resolve(true);
        };
        ws.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 3000);
      });
    } catch (e) {
      console.log('❌ WebSocket connection failed');
    }

    // Check Recipe Service
    try {
      const res = await fetch('http://localhost:3001/api/recipes/health');
      checks.recipe = res.status === 200;
    } catch (e) {
      console.log('❌ Recipe service is not available');
    }

    console.log('\nServer Status:');
    console.log('-------------');
    console.log(`HTTP API: ${checks.http ? '✅' : '❌'}`);
    console.log(`WebSocket: ${checks.websocket ? '✅' : '❌'}`);
    console.log(`Recipe Service: ${checks.recipe ? '✅' : '❌'}`);
    console.log('-------------');

    const allRunning = Object.values(checks).every(Boolean);
    console.log(`\nOverall Status: ${allRunning ? '✅ All services running' : '❌ Some services are down'}`);
    process.exit(allRunning ? 0 : 1);
  } catch (error) {
    console.error('Failed to check server status:', error);
    process.exit(1);
  }
}

checkServer();
