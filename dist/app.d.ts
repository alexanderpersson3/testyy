/**
 * Main application entry point
 *
 * Note on ESM imports:
 * We use .js extensions in imports (e.g., './routes/auth.js') even though the source files are .ts
 * This is required because:
 * 1. We're using ESM modules (package.json "type": "module")
 * 2. TypeScript is configured with "moduleResolution": "NodeNext"
 * 3. At runtime, the compiled files will be .js
 *
 * TypeScript may show linter errors about not finding modules with .js extensions,
 * but this can be safely ignored as it's a known limitation of TypeScript's
 * module resolution when using ESM. The code will work correctly both in:
 * - Development (tsx handles this properly)
 * - Production (tsc compiles .ts to .js)
 */
import 'dotenv/config';
declare const app: import("express-serve-static-core").Express;
export default app;
//# sourceMappingURL=app.d.ts.map