# TypeScript Fixes Roadmap

## Overview
Current Status: ~800 errors in 111 files (85 fixed)
Last Updated: [Current Date]

## Phase 1: Critical Type Definition Issues
### High Priority Fixes

#### 1.1 Recipe Type System
- [x] Fix Recipe type exports in `src/types/recipe.ts`
- [x] Add missing stats properties (likes, shares, comments)
- [x] Update Recipe interfaces across all services
- [x] Fix Recipe type imports in services
- [x] Add proper visibility handling
- [x] Add follower check implementation
- [x] Add like system implementation
- [x] Add recipe sharing system
- [x] Add recipe reporting system
- [x] Add recipe remix system

#### 1.2 Service Constructor Patterns
- [x] Fix ChallengeService constructor
- [x] Fix SearchService constructor
- [x] Fix VariationsService constructor
- [x] Fix CookingSessionService constructor
- [x] Fix ImportService constructor
- [x] Fix MapService constructor
- [x] Fix SocialService constructor
- [x] Fix ShoppingListService constructor
- [x] Fix ExportService constructor
- [ ] Update remaining service singleton patterns

#### 1.3 Missing Type Definitions
- [x] Create `src/utils/recipe-parser.ts`
- [x] Create `src/utils/format-detector.ts`
- [x] Create `src/utils/recipe-validator.ts`
- [x] Create `src/utils/recipe-sanitizer.ts`
- [x] Create `src/utils/recipe-converter.ts`

## Progress Notes
1. Created recipe-parser.ts with:
   - ParsedRecipe interface
   - ParserOptions interface
   - Full type safety for parsing functions
   - Conversion utilities to Recipe type

2. Created format-detector.ts with:
   - FormatDetectionResult interface
   - FormatSignature interface
   - Type-safe format detection and metadata extraction
   - Support for JSON and CSV formats

3. Created recipe-validator.ts with:
   - ValidationResult interface
   - ValidationError and ValidationWarning interfaces
   - Comprehensive validation rules
   - Type-safe validation functions

4. Created recipe-sanitizer.ts with:
   - SanitizeOptions interface
   - HTML sanitization support
   - Text normalization
   - Type-safe sanitization functions

5. Created recipe-variation.ts with:
   - RecipeVariation interface
   - VariationDocument interface
   - VariationReview interface
   - VariationStats interface
   - Type-safe request/response types

6. Fixed VariationsService:
   - Proper singleton pattern
   - Type-safe collection references
   - Fixed review aggregation
   - Improved error handling

7. Improved RecipeService:
   - Updated to use RecipeDocument type
   - Fixed return types for all methods
   - Added proper type for filter queries
   - Fixed findOneAndUpdate return type
   - Added missing stats initialization
   - Added proper error handling
   - Fixed type exports and imports
   - Added proper type guards for optional fields
   - Added proper MongoDB type handling

8. Improved ImportService:
   - Added proper type definitions
   - Fixed recipe parsing and validation
   - Added recipe conversion utilities
   - Improved error handling
   - Added recipe sanitization
   - Added getFileContent method to StorageService
   - Fixed notification channel types
   - Added findRecipeByTitle to RecipeService
   - Fixed recipe type conversion issues
   - Made fileKey required in ImportJob
   - Added null checks for ObjectId

9. Improved MapService:
   - Fixed StoreProductWithProduct interface
   - Added proper error handling
   - Added type-safe collection references
   - Removed redundant type annotations
   - Added proper error classes
   - Improved initialization error handling
   - Added proper null checks
   - Fixed type issues in map queries
   - Added proper error handling for store operations
   - Added distance calculation utilities
   - Added proper type guards for optional fields
   - Added proper aggregation pipeline types
   - Added active deals filtering

10. Improved Recipe Routes:
    - Updated to use RecipeService
    - Added proper type validation
    - Fixed file upload handling
    - Added visibility controls
    - Improved error handling
    - Added proper authorization checks
    - Fixed null checks for optional fields
    - Added support for follower-based visibility
    - Integrated with SocialService for follower checks
    - Added custom error classes
    - Fixed service initialization patterns
    - Added like system with proper types
    - Added pagination support for likes
    - Added user details in like responses
    - Added proper MongoDB aggregation types

11. Improved Shopping List Routes:
    - Updated to use ShoppingListService consistently
    - Fixed type validation for all routes
    - Added proper error handling
    - Fixed service initialization patterns
    - Added proper MongoDB type handling
    - Added proper validation schemas
    - Fixed collaborator handling
    - Added proper caching
    - Added proper authorization checks
    - Fixed ObjectId handling

12. Improved Shopping List System:
    - Added bulk operations support
    - Added proper type definitions for bulk operations
    - Added validation schemas for bulk operations
    - Added proper error handling for bulk operations
    - Added WebSocket notifications for bulk operations
    - Fixed type safety in bulk operations
    - Added proper MongoDB type handling
    - Added proper authorization checks
    - Added proper error reporting
    - Added proper transaction handling

13. Added Shopping List Template System:
    - Added template type definitions
    - Added template validation schemas
    - Added template service methods
    - Added template routes
    - Added proper error handling
    - Added proper authorization checks
    - Added proper type safety
    - Added proper MongoDB type handling
    - Added template search functionality
    - Added template usage tracking

14. Added Shopping List Price Comparison:
    - Added price comparison type definitions
    - Added price alert type definitions
    - Added price comparison service methods
    - Added price alert service methods
    - Added price comparison routes
    - Added price alert routes
    - Added store availability tracking
    - Added distance calculation
    - Added deal tracking
    - Added price alert preferences
    - Added notification support
    - Added proper error handling
    - Added proper type safety
    - Added proper MongoDB type handling
    - Added proper validation schemas

15. Improved SearchService:
    - Added proper interface definition
    - Added initialization pattern
    - Added input validation
    - Added proper type safety for queries
    - Added proper error handling
    - Added proper MongoDB type handling
    - Added proper facet handling
    - Added proper highlighting
    - Added proper analytics integration
    - Added proper performance tracking

16. Improved ExportService:
    - Added proper interface definition
    - Added initialization pattern
    - Added input validation
    - Added proper type safety for exports
    - Added proper error handling
    - Added proper MongoDB type handling
    - Added proper file handling
    - Added proper cleanup for temp files
    - Added proper notification handling
    - Added proper template handling

17. Improved ImportService:
    - Added proper interface definition
    - Added initialization pattern
    - Added input validation
    - Added proper type safety for imports
    - Added proper error handling
    - Added proper MongoDB type handling
    - Added proper file format detection
    - Added proper recipe parsing
    - Added proper duplicate handling
    - Added proper notification handling

## Phase 2: Interface Alignment
### Medium Priority Fixes

#### 2.1 Comment System
- [x] Update Comment interface to include userVote
- [x] Fix CommentTree interface inheritance
- [x] Update comment-related services and tests

#### 2.2 Test Type Definitions
- [x] Fix mock data types in test files
- [ ] Update test utility functions
- [ ] Add proper type assertions in tests

#### 2.3 Service Type Alignments
- [x] Fix MapService type definitions
- [ ] Update OfflineRecipeService types
- [ ] Correct ScalingService type issues

## Phase 3: Import/Export System
### Lower Priority Fixes

#### 3.1 Circular Dependencies
- [ ] Audit and fix circular imports
- [ ] Restructure type imports
- [ ] Create proper type barrel files

#### 3.2 Missing Exports
- [ ] Add missing exports in service files
- [ ] Fix type re-exports
- [ ] Update index files

## Phase 4: Route System
### Final Fixes

#### 4.1 Route Types
- [ ] Fix auth middleware types
- [ ] Update request/response types
- [ ] Add proper validation types

#### 4.2 Controller Types
- [ ] Update controller parameter types
- [ ] Fix response type definitions
- [ ] Add proper error types

## File-specific Issues

### High Priority Files
1. `src/services/recipe.service.ts` (5 errors)
   - [ ] Fix Recipe type export
   - [ ] Update method signatures
   - [ ] Fix return types

2. `src/services/map-service.ts` (17 errors)
   - [ ] Add missing property definitions
   - [ ] Fix collection types
   - [ ] Update method parameters

3. `src/routes/shopping-list.ts` (54 errors)
   - [ ] Fix type imports
   - [ ] Update route handlers
   - [ ] Add proper validation

### Medium Priority Files
1. `src/routes/social.ts` (43 errors)
2. `src/routes/collection.routes.ts` (31 errors)
3. `src/routes/analytics.routes.ts` (27 errors)

### Lower Priority Files
1. Various test files (type assertion errors)
2. Utility functions (parameter typing)
3. Route handler type definitions

## Progress Tracking

### Metrics
- Total Initial Errors: 1030
- Files Affected: 111
- Critical Paths: 15 files with >20 errors each

### Completion Checklist
- [ ] Phase 1 Complete
- [ ] Phase 2 Complete
- [ ] Phase 3 Complete
- [ ] Phase 4 Complete
- [ ] All Tests Passing
- [ ] Build Successful

## Notes
- Keep track of any breaking changes
- Document interface changes
- Update tests as types are fixed
- Maintain backward compatibility where possible

## Dependencies
- TypeScript 4.x
- Node.js types
- MongoDB types
- Express types

## Testing Strategy
1. Fix types in isolation
2. Run affected tests
3. Run full test suite
4. Verify build
5. Manual testing of affected features 