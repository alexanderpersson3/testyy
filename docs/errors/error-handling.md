# Error Handling Documentation

## Overview
This document describes the error handling system implemented in the Rezepta Backend application. The system provides a centralized, consistent way to handle errors across the application with proper logging, monitoring, and client responses.

## Table of Contents
1. [Error Types](#error-types)
2. [Using Error Handling](#using-error-handling)
3. [Error Response Format](#error-response-format)
4. [Logging and Monitoring](#logging-and-monitoring)
5. [Best Practices](#best-practices)

## Error Types

### Base Error
```javascript
import { AppError } from '../utils/errors.js';

// Base error with custom status code and error code
new AppError('Custom error message', 500, 'CUSTOM_ERROR');
```

### Authentication Errors
```javascript
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';

// Authentication failed
throw new AuthenticationError('Invalid credentials');

// Authorization failed
throw new AuthorizationError('Insufficient permissions');
```

### Validation Errors
```javascript
import { ValidationError } from '../utils/errors.js';

// Single validation error
throw new ValidationError('Invalid input');

// Multiple validation errors
throw new ValidationError('Validation failed', [
  { field: 'email', message: 'Invalid email format' },
  { field: 'password', message: 'Password too weak' }
]);
```

### Resource Errors
```javascript
import { NotFoundError, ConflictError } from '../utils/errors.js';

// Resource not found
throw new NotFoundError('User');

// Resource conflict
throw new ConflictError('Email already exists');
```

### System Errors
```javascript
import { 
  DatabaseError,
  CacheError,
  IntegrationError,
  PerformanceError,
  TimeoutError
} from '../utils/errors.js';

// Database errors
throw new DatabaseError('Connection failed');

// Cache errors
throw new CacheError('Redis connection failed');

// Integration errors
throw new IntegrationError('PaymentService', 'API timeout');

// Performance errors
throw new PerformanceError('Query took too long');

// Timeout errors
throw new TimeoutError('Request timed out');
```

### Business Logic Errors
```javascript
import { BusinessError } from '../utils/errors.js';

throw new BusinessError('Insufficient funds', 'PAYMENT_FAILED');
```

## Using Error Handling

### In Route Handlers
```javascript
const createRecipe = async (req, res, next) => {
  try {
    // Validation
    if (!req.body.title) {
      throw new ValidationError('Recipe title is required');
    }

    // Resource checks
    const existingRecipe = await Recipe.findOne({ title: req.body.title });
    if (existingRecipe) {
      throw new ConflictError('Recipe with this title already exists');
    }

    // Database operations
    const recipe = await Recipe.create(req.body);
    res.status(201).json(recipe);
  } catch (err) {
    next(err); // Pass to error handler
  }
};
```

### In Services
```javascript
class PaymentService {
  async processPayment(userId, amount) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User');
      }

      if (user.balance < amount) {
        throw new BusinessError('Insufficient balance', 'INSUFFICIENT_FUNDS');
      }

      // Process payment
    } catch (error) {
      if (error.name === 'MongoError') {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
}
```

## Error Response Format

### Development Environment
```json
{
  "error": {
    "errorCode": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "status": "fail",
    "stack": "Error stack trace...",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ],
    "path": "/api/users",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-123"
  }
}
```

### Production Environment
```json
{
  "error": {
    "errorCode": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "status": "fail",
    "path": "/api/users",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-123"
  }
}
```

## Logging and Monitoring

### Error Log Format
```javascript
// Operational errors (warnings)
{
  severity: 'warning',
  type: 'request_error',
  errorCode: 'VALIDATION_ERROR',
  message: 'Invalid input',
  path: '/api/users',
  method: 'POST',
  userId: '123',
  requestId: 'req-123',
  timestamp: '2023-12-10T12:00:00.000Z'
}

// System errors (critical)
{
  severity: 'critical',
  type: 'system_error',
  errorCode: 'DATABASE_ERROR',
  message: 'Connection failed',
  stack: '...',
  requestId: 'req-123',
  timestamp: '2023-12-10T12:00:00.000Z'
}
```

### Monitoring Events
- `request_error`: Operational errors during request handling
- `system_error`: Non-operational system errors
- `unhandled_rejection`: Unhandled promise rejections
- `uncaught_exception`: Uncaught exceptions
- `non_operational_error`: Critical system errors

## Best Practices

### 1. Always Use Custom Error Types
```javascript
// ❌ Bad
throw new Error('User not found');

// ✅ Good
throw new NotFoundError('User');
```

### 2. Include Relevant Error Details
```javascript
// ❌ Bad
throw new ValidationError('Invalid input');

// ✅ Good
throw new ValidationError('Validation failed', [
  { field: 'email', message: 'Invalid email format' }
]);
```

### 3. Handle Async Operations Properly
```javascript
// ❌ Bad
app.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json(user);
});

// ✅ Good
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new NotFoundError('User');
    res.json(user);
  } catch (err) {
    next(err);
  }
});
```

### 4. Use Error Codes Consistently
```javascript
// ❌ Bad
throw new AppError('Payment failed', 400);

// ✅ Good
throw new BusinessError('Payment failed', 'PAYMENT_FAILED');
```

### 5. Clean Up Resources on Critical Errors
```javascript
// In error handler
if (!isOperationalError(err)) {
  // Clean up resources
  await cleanupConnections();
  // Notify DevOps
  await notifyDevOps(err);
  // Exit process gracefully
  process.exit(1);
}
```

### 6. Validate Input Early
```javascript
// ❌ Bad
async function createUser(data) {
  const user = await User.create(data); // Might fail with cryptic DB error
}

// ✅ Good
async function createUser(data) {
  if (!data.email) {
    throw new ValidationError('Email is required');
  }
  if (!isValidEmail(data.email)) {
    throw new ValidationError('Invalid email format');
  }
  const user = await User.create(data);
}
```

### 7. Log Sensitive Information Safely
```javascript
// ❌ Bad
logError({
  ...error,
  user: req.user,
  headers: req.headers // Might contain auth tokens
});

// ✅ Good
logError({
  ...error,
  userId: req.user?.id,
  headers: {
    ...req.headers,
    authorization: undefined
  }
});
``` 