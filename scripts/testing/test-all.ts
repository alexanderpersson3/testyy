import { spawn } from 'child_process';
import { resolve } from 'path';

async function runCommand(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    console.log(`\nRunning: ${command} ${args.join(' ')}`);

    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
    });

    proc.on('close', code => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    proc.on('error', err => {
      reject(err);
    });
  });
}

async function runTests() {
  try {
    // Run linting
    console.log('\n=== Running ESLint ===');
    await runCommand('npm', ['run', 'lint']);

    // Run unit tests
    console.log('\n=== Running Unit Tests ===');
    await runCommand('npm', ['test', '--', '--testPathPattern=src/tests/(?!integration)']);

    // Run integration tests
    console.log('\n=== Running Integration Tests ===');
    await runCommand('npm', ['test', '--', '--testPathPattern=src/tests/integration']);

    // Run performance tests
    console.log('\n=== Running Performance Tests ===');
    await runCommand('tsx', ['scripts/performance-test.ts']);

    console.log('\n✅ All tests completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  }
}

runTests();
