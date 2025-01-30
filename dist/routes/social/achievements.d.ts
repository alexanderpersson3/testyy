/**
 * Achievement routes for handling user achievements, badges, ranks, and tracking.
 * Provides endpoints for managing the gamification aspects of the application,
 * including leaderboards, user badges, and achievement tracking.
 *
 * Known TypeScript Issue:
 * Express's type system has limitations with async route handlers returning Response objects.
 * This is a known issue (see: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/50871).
 * We're using @ts-expect-error comments as a workaround until this is fixed in Express's types.
 *
 * @module routes/social/achievements
 * @see .github/ISSUES/TS-001-express-async-handlers.md for detailed explanation
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=achievements.d.ts.map