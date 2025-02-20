# Type System Analysis (2024-02-20)

## Latest Progress

### Attempted Solutions

1. Router Factory Attempt #1:
```typescript
// In router.ts
import { Router } from 'express';
import { AuthRouter } from '@/types/express';

export const createAuthRouter = (): AuthRouter => {
  const router = Router();
  return router as unknown as AuthRouter;
};
```
Result: Failed due to import conflicts and type mismatches

2. Router Factory Attempt #2:
```typescript
// In router.ts
import type { Router } from 'express';
import type { AuthRouter } from '@/types/express';

export class TypedRouter {
  private router: Router;
  // ... implementation
}
```
Result: Failed due to duplicate Router imports and missing exports

3. Router Factory Attempt #3:
```typescript
// In express.d.ts
export interface AuthRouter extends ExpressRouter {
  // ... method definitions
}
```
Result: Partially successful but still having handler type mismatches

### Current Blockers

1. Import Resolution Issues:
   - Circular dependencies between express.d.ts and router.ts
   - Type vs Value imports causing conflicts
   - Multiple Router type definitions

2. Handler Type Mismatches:
   ```typescript
   Type '(req: TypedRequest<P, ResBody, ReqBody, ReqQuery>, res: TypedResponse<ResBody>, next: NextFunction) => Promise<void>' 
   is not assignable to type 'TypedAuthHandler<P, ResBody, ReqBody, ReqQuery>'
   ```

3. Authentication Marker Issues:
   ```typescript
   Type '(...) => Promise<void>' is not assignable to type '{ __auth: true; }'
   ```

### Root Cause Analysis

1. Type Definition Location:
   - express.d.ts trying to both declare and implement
   - Router implementation mixed with type declarations
   - Circular type references

2. Authentication Marking:
   - __auth property not properly propagated
   - Type intersection vs interface extension confusion
   - Handler wrapper losing type information

3. Import Structure:
   - Mixing type and value imports
   - Multiple import sources for same types
   - Inconsistent import paths

## Solution Strategy

### Phase 1: Restructure Type Definitions

1. Separate Type Declarations:
```typescript
// types/express/base.d.ts
import type { Router as ExpressRouter } from 'express';

export interface BaseRouter extends ExpressRouter {
  // Base router types
}

// types/express/auth.d.ts
import type { BaseRouter } from './base';

export interface AuthRouter extends BaseRouter {
  // Auth specific types
}
```

2. Separate Implementations:
```typescript
// utils/router/base.ts
import { Router } from 'express';
import type { BaseRouter } from '@/types/express/base';

// utils/router/auth.ts
import type { AuthRouter } from '@/types/express/auth';
```

### Phase 2: Fix Authentication Marking

1. Create Auth Type Factory:
```typescript
type WithAuth<T> = T & { __auth: true };

export const markAsAuth = <T>(handler: T): WithAuth<T> => {
  return Object.assign(handler, { __auth: true }) as WithAuth<T>;
};
```

2. Update Handler Types:
```typescript
export type TypedAuthHandler<P, ResBody, ReqBody, ReqQuery> = 
  WithAuth<(req: AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery>,
           res: TypedResponse<ResBody>,
           next: NextFunction) => Promise<void> | void>;
```

## Next Actions

1. Restructure Type Files:
   - [ ] Create separate type declaration files
   - [ ] Move implementations to separate files
   - [ ] Update import paths

2. Fix Authentication Marking:
   - [ ] Implement WithAuth type factory
   - [ ] Update handler wrappers
   - [ ] Fix type propagation

3. Update Router Factory:
   - [ ] Create proper factory function
   - [ ] Fix method chaining
   - [ ] Handle type casting

Critical Reminder: We need to solve the authentication marking issue first, as it's the root cause of our handler type mismatches.

## Testing Strategy

1. Type Tests:
```typescript
// Type should compile
const handler: TypedAuthHandler = markAsAuth((req, res) => {
  req.user // Should be typed
  res.json({ success: true, data: {} })
});

// Should fail to compile
const handler: TypedAuthHandler = (req, res) => {
  // Missing __auth
};
```

Remember: Focus on fixing the authentication marking first, then rebuild the router factory with proper type support. 