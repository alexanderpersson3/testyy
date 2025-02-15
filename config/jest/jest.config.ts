import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
      diagnostics: {
        ignoreCodes: [1343, 6133]
      }
    }
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-is)/)',
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,ts}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/tests/**',
    '!src/types/**',
    '!src/config/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/services/__tests__/setup.ts'],
  globalSetup: '<rootDir>/src/services/__tests__/setup.ts',
  globalTeardown: '<rootDir>/src/services/__tests__/teardown.ts',
  verbose: true,
  testTimeout: 30000,
  maxWorkers: '50%',
  moduleNameMapper: {
    '^react-is$': 'react-is',
    '^react-is/(.*)$': 'react-is/$1',
  },
};

export default config;
