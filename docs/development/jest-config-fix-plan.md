# Jest Configuration Fix Plan

## Problem
The current Jest configuration has an overly aggressive module mapping that tries to convert all .js imports to .ts files, including those in node_modules. This is causing failures when trying to load the react-is package.

## Solution

### 1. Update moduleNameMapper in jest.config.cjs
Need to modify the configuration to:
- Keep source file mapping
- Add proper react-is mapping
- Exclude node_modules from JS to TS mapping

```js
moduleNameMapper: {
  // Map source .js imports to .ts files, excluding node_modules
  '^(\\.{1,2}/(?!node_modules).*)\.js$': '$1.ts',
  // Add specific mapping for react-is
  '^react-is$': 'react-is',
  '^react-is/(.*)$': 'react-is/$1',
  // Keep the existing src alias
  '^@/(.*)$': '<rootDir>/src/$1'
},
```

### 2. Add transformIgnorePatterns
Add configuration to prevent transformation of node_modules except for react-is:

```js
transformIgnorePatterns: [
  'node_modules/(?!(react-is)/)',
],
```

### 3. Consolidate Jest Configurations
Currently there are two Jest configuration files:
- jest.config.ts
- jest.config.cjs

We should either:
a) Consolidate into a single configuration file, or
b) Ensure both files have consistent settings

For this fix, we'll implement the changes in jest.config.cjs since it appears to be the one being used, and then we can address the configuration duplication as a separate task if needed.

## Implementation Steps
1. Switch to Code mode
2. Apply the moduleNameMapper changes to jest.config.cjs
3. Add transformIgnorePatterns to jest.config.cjs
4. Run tests to verify the fix works