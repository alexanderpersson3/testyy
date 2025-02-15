import { execSync } from 'child_process';

const typeDependencies = [
  '@types/express',
  '@types/mongodb',
  '@types/jsonwebtoken',
  '@types/joi',
  '@types/node'
];

console.log('Installing type declarations...');

try {
  execSync(`cd ../../backend && npm install -D ${typeDependencies.join(' ')}`, {
    stdio: 'inherit'
  });
  console.log('Type declarations installed successfully');
} catch (error) {
  console.error('Failed to install type declarations:', error);
  process.exit(1);
} 