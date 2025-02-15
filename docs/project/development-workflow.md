# Development Workflow Guide

## Overview
This document outlines the development workflow and best practices for contributing to the Rezepta Backend project.

## Development Environment Setup

### 1. Initial Setup
```bash
# Clone repository
git clone https://github.com/your-org/rezepta-backend.git
cd rezepta-backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Setup pre-commit hooks
npm run prepare
```

### 2. Development Tools
- VS Code with recommended extensions:
  - ESLint
  - Prettier
  - MongoDB for VS Code
  - Thunder Client
- MongoDB Compass for database management
- Postman for API testing

## Git Workflow

### 1. Branch Naming Convention
```
feature/   # New features
fix/       # Bug fixes
refactor/  # Code refactoring
docs/      # Documentation updates
test/      # Test additions/updates
chore/     # Maintenance tasks
```

Example: `feature/add-recipe-rating`

### 2. Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

Example:
```
feat(recipe): add rating functionality

- Add rating model
- Implement rating endpoints
- Add validation middleware

Closes #123
```

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructuring
- test: Test updates
- chore: Maintenance

### 3. Development Flow
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push changes
git push origin feature/new-feature

# Create pull request
# Review and merge
```

## Code Style

### 1. ESLint Configuration
```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:node/recommended'
  ],
  rules: {
    'no-console': 'warn',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'node/exports-style': ['error', 'module.exports'],
    'node/file-extension-in-import': ['error', 'always']
  }
};
```

### 2. Prettier Configuration
```json
{
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 80,
  "tabWidth": 2,
  "semi": true
}
```

### 3. Code Organization
```
src/
├── config/         # Configuration
├── controllers/    # Route handlers
├── middleware/     # Custom middleware
├── models/         # Data models
├── routes/         # API routes
├── services/       # Business logic
└── utils/          # Helper functions
```

## Testing

### 1. Unit Tests
```javascript
// Example test file
describe('Recipe Service', () => {
  beforeEach(async () => {
    await Recipe.deleteMany({});
  });

  it('should create recipe', async () => {
    const recipe = {
      title: 'Test Recipe',
      description: 'Test Description'
    };
    
    const result = await recipeService.create(recipe);
    expect(result.title).toBe(recipe.title);
  });
});
```

### 2. Integration Tests
```javascript
describe('Recipe API', () => {
  it('should create recipe', async () => {
    const response = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Test Recipe',
        description: 'Test Description'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Test Recipe');
  });
});
```

### 3. Test Coverage
```bash
# Run tests with coverage
npm run test:coverage

# Coverage thresholds
{
  "coverage": {
    "statements": 80,
    "branches": 80,
    "functions": 80,
    "lines": 80
  }
}
```

## Code Review

### 1. Pull Request Template
```markdown
## Description
Brief description of changes

## Type of change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Code follows style guidelines
- [ ] All tests passing
```

### 2. Review Guidelines
- Check code style compliance
- Verify test coverage
- Review security implications
- Check performance impact
- Validate documentation

## Continuous Integration

### 1. GitHub Actions Workflow
```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Run linting
        run: npm run lint
```

### 2. Quality Gates
- All tests passing
- Code coverage thresholds met
- No linting errors
- Security scan passed
- Performance benchmarks met

## Debugging

### 1. Logging
```javascript
// Use structured logging
const log = createStructuredLog('debug', {
  component: 'RecipeService',
  method: 'create',
  params: { recipeId }
});

// Add request context
app.use((req, res, next) => {
  req.log = log.child({
    requestId: req.id,
    path: req.path
  });
  next();
});
```

### 2. Error Handling
```javascript
try {
  await recipeService.create(data);
} catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: {
        message: error.message,
        details: error.details
      }
    });
  }
  throw error;
}
```

## Performance Optimization

### 1. Database Queries
```javascript
// Use proper indexes
Recipe.createIndex({ author: 1, createdAt: -1 });

// Optimize queries
const recipes = await Recipe
  .find({ author })
  .select('title description')
  .limit(10)
  .lean();
```

### 2. Caching
```javascript
// Implement caching
const getRecipe = async (id) => {
  const cacheKey = `recipe:${id}`;
  let recipe = await cache.get(cacheKey);
  
  if (!recipe) {
    recipe = await Recipe.findById(id);
    await cache.set(cacheKey, recipe, 3600);
  }
  
  return recipe;
};
```

## Deployment

### 1. Environment Configuration
```bash
# Development
npm run dev

# Staging
NODE_ENV=staging npm start

# Production
NODE_ENV=production npm start
```

### 2. Database Migration
```javascript
// Create migration
const migration = {
  version: '1.0.0',
  up: async () => {
    await Recipe.updateMany({}, {
      $set: { status: 'active' }
    });
  },
  down: async () => {
    await Recipe.updateMany({}, {
      $unset: { status: '' }
    });
  }
};
```

## Monitoring

### 1. Health Checks
```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date(),
    services: {
      database: await checkDatabase(),
      cache: await checkCache(),
      queue: await checkQueue()
    }
  };
  
  res.json(health);
});
```

### 2. Performance Monitoring
```javascript
// Monitor response times
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.recordResponseTime(duration, {
      path: req.path,
      method: req.method
    });
  });
  next();
});
``` 