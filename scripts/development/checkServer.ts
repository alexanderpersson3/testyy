import { checkServerStatus } from '../frontend/src/utils/checkServerStatus';

async function runCheck() {
  console.log('Checking server status...\n');
  
  const status = await checkServerStatus();
  
  console.log('Server Status Report:');
  console.log('===================');
  console.log(status.details.join('\n'));
  console.log('===================');
  console.log(`Overall Status: ${status.isRunning ? '✅ Server is fully operational' : '❌ Server has issues'}\n`);
  
  process.exit(status.isRunning ? 0 : 1);
}

runCheck().catch(console.error);
