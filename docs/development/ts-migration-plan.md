# TypeScript Migration Plan

## Overview
This document outlines the plan for migrating JavaScript files to TypeScript in the Rezepta backend project.

## Files to Convert
Key JavaScript files identified for conversion:

### Root Directory
- app.js → app.ts
- auth.js → auth.ts
- collection.js → collection.ts
- connectDB.js → connectDB.ts
- db.js → db.ts
- index.js → index.ts
- price.js → price.ts
- rezapta.js → rezapta.ts
- server.js → server.ts
- social.js → social.ts

### Config Directory
- config/audit-logger.js → audit-logger.ts
- config/db.js → db.ts
- config/profanity-sv.js → profanity-sv.ts
- config/proxies.js → proxies.ts
- config/security.js → security.ts
- config/tasks.js → tasks.ts
- config/test.js → test.ts

### Middleware Directory
- middleware/auth.js → auth.ts
- middleware/cache.js → cache.ts
- middleware/error-handler.js → error-handler.ts
- middleware/rate-limit.js → rate-limit.ts
- middleware/ws-auth.js → ws-auth.ts

### Routes Directory
All files in routes/ directory need to be converted from .js to .ts

### Tests Directory
- __tests__/*.js files need to be converted to .ts

## Migration Strategy

### 1. Initial Setup (Complete)
- TypeScript configuration is already set up (tsconfig.json)
- Build tools and dependencies are in place
- Source maps are enabled for debugging

### 2. Implementation Approach
1. Convert files in dependency order (bottom-up):
   - Utilities and helpers first
   - Models and database files
   - Middleware
   - Routes
   - Main application files

2. For each file:
   - Create a new .ts file
   - Add type annotations incrementally
   - Update imports/exports
   - Fix any type errors
   - Update tests

3. Use TypeScript's allowJs option (already enabled) to allow gradual migration

### 3. Type Definition Strategy
- Use existing @types packages where available
- Create custom type definitions where needed
- Place shared interfaces in src/types directory

## Potential Challenges

1. **CommonJS to ESM**: Some files use require/module.exports which needs to be converted to import/export
2. **Missing Type Definitions**: May need to create custom type definitions for some dependencies
3. **Complex MongoDB Queries**: Need careful typing for database operations and aggregations
4. **Test Files**: Jest configuration may need updates for TypeScript tests

## Quality Gates

1. All TypeScript files must:
   - Pass the TypeScript compiler with strict mode
   - Have no 'any' types unless explicitly justified
   - Include proper JSDoc comments
   - Pass existing tests
   - Maintain existing functionality

2. Testing Requirements:
   - All tests must pass
   - Test coverage must be maintained or improved
   - New types must be tested

## Migration Order

1. **Phase 1: Core Utilities**
   - db.js
   - connectDB.js
   - config/*.js

2. **Phase 2: Models and Services**
   - collection.js
   - services/*.js

3. **Phase 3: Middleware**
   - middleware/*.js

4. **Phase 4: Routes**
   - routes/*.js

5. **Phase 5: Main Application**
   - app.js
   - server.js
   - index.js

6. **Phase 6: Tests**
   - __tests__/*.js
   - Convert test utilities and helpers

## Post-Migration Tasks

1. Update build scripts
2. Remove allowJs from tsconfig.json
3. Update CI/CD pipeline
4. Update documentation
5. Performance testing
6. Review and remove any temporary type assertions

## Notes

- Keep commits small and focused
- Test each conversion thoroughly
- Document any workarounds or technical decisions
- Monitor for performance impacts