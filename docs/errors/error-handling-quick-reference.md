# Error Handling Quick Reference

## Common Error Scenarios

### Authentication & Authorization
```javascript
// User not authenticated
throw new AuthenticationError('Please log in to access this resource');

// Invalid credentials
throw new AuthenticationError('Invalid email or password');

// Token expired
throw new AuthenticationError('Session expired, please log in again');

// Insufficient permissions
throw new AuthorizationError('Admin access required');

// 2FA required
throw new AuthenticationError('Two-factor authentication required');
```

### Resource Operations
```javascript
// Resource not found
throw new NotFoundError('Recipe');

// Duplicate resource
throw new ConflictError('Recipe with this title already exists');

// Resource already in use
throw new ConflictError('Email address already registered');

// Resource locked
throw new ConflictError('Recipe is currently being edited by another user');
```

### Validation
```javascript
// Missing required fields
throw new ValidationError('Missing required fields', [
  { field: 'title', message: 'Title is required' }
]);

// Invalid format
throw new ValidationError('Invalid format', [
  { field: 'email', message: 'Invalid email format' }
]);

// Invalid length
throw new ValidationError('Invalid length', [
  { field: 'password', message: 'Password must be at least 8 characters' }
]);

// Invalid value
throw new ValidationError('Invalid value', [
  { field: 'age', message: 'Age must be between 18 and 120' }
]);
```

### Database Operations
```javascript
// Connection failed
throw new DatabaseError('Database connection failed');

// Query timeout
throw new DatabaseError('Database query timeout');

// Transaction failed
throw new DatabaseError('Transaction rollback: operation failed');

// Index creation failed
throw new DatabaseError('Failed to create index');
```

### Cache Operations
```javascript
// Cache miss
throw new CacheError('Cache entry not found');

// Cache write failed
throw new CacheError('Failed to write to cache');

// Cache connection lost
throw new CacheError('Redis connection lost');

// Cache eviction
throw new CacheError('Cache eviction failed');
```

### External Services
```javascript
// API timeout
throw new IntegrationError('PaymentAPI', 'Request timed out');

// Service unavailable
throw new IntegrationError('EmailService', 'Service temporarily unavailable');

// Invalid response
throw new IntegrationError('SearchAPI', 'Invalid response format');

// Rate limit exceeded
throw new IntegrationError('ExternalAPI', 'Rate limit exceeded');
```

### Performance Issues
```javascript
// Slow query
throw new PerformanceError('Query execution exceeded 5000ms');

// High memory usage
throw new PerformanceError('Memory usage exceeded threshold');

// High CPU usage
throw new PerformanceError('CPU usage exceeded 80%');

// Connection pool exhausted
throw new PerformanceError('Connection pool exhausted');
```

### Business Logic
```javascript
// Insufficient funds
throw new BusinessError('Insufficient balance', 'INSUFFICIENT_FUNDS');

// Account locked
throw new BusinessError('Account temporarily locked', 'ACCOUNT_LOCKED');

// Limit exceeded
throw new BusinessError('Daily limit exceeded', 'LIMIT_EXCEEDED');

// Invalid state
throw new BusinessError('Order cannot be cancelled in current state', 'INVALID_STATE');
```

## HTTP Status Codes Reference

### 2xx Success
- 200: OK (Default success)
- 201: Created (Resource created)
- 204: No Content (Success, no response body)

### 4xx Client Errors
- 400: Bad Request (ValidationError)
- 401: Unauthorized (AuthenticationError)
- 403: Forbidden (AuthorizationError)
- 404: Not Found (NotFoundError)
- 409: Conflict (ConflictError)
- 429: Too Many Requests (RateLimitError)

### 5xx Server Errors
- 500: Internal Server Error (DatabaseError, CacheError)
- 502: Bad Gateway (IntegrationError)
- 503: Service Unavailable (PerformanceError)
- 504: Gateway Timeout (TimeoutError)

## Error Response Examples

### Authentication Error
```json
{
  "error": {
    "errorCode": "AUTHENTICATION_ERROR",
    "message": "Invalid credentials",
    "status": "fail",
    "path": "/auth/login",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-123"
  }
}
```

### Validation Error
```json
{
  "error": {
    "errorCode": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "status": "fail",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters"
      }
    ],
    "path": "/auth/register",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-124"
  }
}
```

### Business Logic Error
```json
{
  "error": {
    "errorCode": "INSUFFICIENT_FUNDS",
    "message": "Insufficient balance",
    "status": "fail",
    "path": "/payments/process",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-125"
  }
}
```

### System Error (Development)
```json
{
  "error": {
    "errorCode": "DATABASE_ERROR",
    "message": "Database connection failed",
    "status": "error",
    "stack": "Error: Database connection failed\n    at Database.connect...",
    "path": "/recipes/create",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-126"
  }
}
``` 