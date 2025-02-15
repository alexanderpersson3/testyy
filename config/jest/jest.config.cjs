/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    // Map source .js imports to .ts files, excluding node_modules
    '^(\\.{1,2}/(?!node_modules).*)\.js$': '$1.ts',
    // Add specific mapping for react-is
    '^react-is$': 'react-is',
    '^react-is/(.*)$': 'react-is/$1',
    // Keep the existing src alias
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "Node16",
          esModuleInterop: true,
          verbatimModuleSyntax: false,
          allowJs: true
        }
      }
    ]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-is)/)'
  ],
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
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
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/src/services/__tests__/setup.ts'],
  globalSetup: '<rootDir>/src/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/src/tests/globalTeardown.ts',
  verbose: true,
  testTimeout: 10000,
  maxWorkers: '50%'
}