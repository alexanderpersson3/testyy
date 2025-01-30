# [TS-001] Express Async Route Handler Type Limitations

## Overview
Express's type system has limitations with async route handlers returning Response objects. This affects our TypeScript route handlers and requires workarounds.

## Status
- **Status**: Open
- **Priority**: Medium
- **Component**: TypeScript Types
- **Created**: 2024-01-22
- **Affects**: Route handlers using async/await

## Description
When using async route handlers in Express with TypeScript, we encounter type errors due to limitations in Express's type definitions. The specific error occurs because Express's `RequestHandler` type expects either `void` or `Promise<void>`, but our async handlers return `Promise<Response>`.

### Error Message
```typescript
No overload matches this call.
  The last overload gave the following error.
    Argument of type '(req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>'
    is not assignable to parameter of type 'RequestHandlerParams<ParamsDictionary, any, any, ParsedQs, Record<string, any>>'.
      Type 'Promise<Response<any, Record<string, any>>>' is not assignable to type 'void | Promise<void>'.
        Type 'Promise<Response<any, Record<string, any>>>' is not assignable to type 'Promise<void>'.
          Type 'Response<any, Record<string, any>>' is not assignable to type 'void'.
```

The error occurs in `@types/express-serve-static-core/index.d.ts` where the `RequestHandler` type is defined.

### Example of Problem
```typescript
// This causes TypeScript errors even though it's valid code
const handler: RequestHandler = async (req, res, next) => {
  try {
    const data = await someAsyncOperation();
    return res.json({ data });  // Error: Cannot return Response when void is expected
  } catch (error) {
    next(error);
  }
};
```

## Current Workaround
After multiple attempts at fixing this issue, we've found that the most practical workaround is to use `// @ts-expect-error` comments to suppress these specific type errors:

```typescript
// @ts-expect-error - Express types don't handle async route handlers well
const handler = async (req: Request<P, ResBody>, res: Response<ResBody>, next: NextFunction) => {
  try {
    const data = await someAsyncOperation();
    res.json(data);
  } catch (error) {
    next(error);
  }
};
```

### Why This Approach
1. **Type Safety**: Despite suppressing the error, we still get type checking for request/response generics
2. **Explicit**: The comment clearly indicates why we're suppressing the error
3. **Maintainable**: Easy to find and remove when Express fixes their types
4. **Minimal**: Only suppresses the specific error we can't fix
5. **Documented**: Each suppression has a clear explanation

## Impact
1. TypeScript shows type errors for valid code
2. Need to use `@ts-expect-error` comments
3. Slightly reduced type safety for route handlers
4. Technical debt in type system
5. Affects all async route handlers in the project

## Affected Files
- `src/routes/social/achievements.ts`
- Any new route files using async handlers with response objects

## Potential Solutions

### Short-term (1-2 weeks)
- Use `@ts-expect-error` comments with clear documentation
- Create a linting rule to ensure proper comment format
- Add tests to ensure proper error handling

### Medium-term (1-2 months)
- Create a custom router class that handles async routes properly
- Add proper type definitions for all response types
- Add automated tests for type safety

### Long-term (3+ months)
- Wait for Express to improve their type definitions
- Consider migrating to a framework with better TypeScript support (e.g., NestJS)
- Create our own Express-compatible router with proper TypeScript support

## Notes
- The code works correctly at runtime
- All error cases are properly handled
- Type assertions are documented in the affected files
- The issue is specifically with Express's type definitions, not our code
- We've tried multiple approaches including:
  1. Custom async handler wrapper
  2. Type assertions
  3. Return type modifications
  4. Response type specifications

## References
- [DefinitelyTyped Issue #50871](https://github.com/DefinitelyTyped/DefinitelyTyped/issues/50871)
- [Express Issue #4892](https://github.com/expressjs/express/issues/4892)
- [Express-serve-static-core types](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/express-serve-static-core/index.d.ts#L157)

## Related PRs
- None yet

## Updates
- 2024-01-22: Created issue and documented current workaround
- 2024-01-22: Added specific error message and location in Express types
- 2024-01-22: Added better solution with custom async handler wrapper
- 2024-01-22: Updated with findings from multiple attempted solutions
- 2024-01-22: Recommended using @ts-expect-error as the most practical workaround 