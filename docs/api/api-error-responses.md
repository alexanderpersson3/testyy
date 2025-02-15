# API Error Response Documentation

## Overview
This document describes the standardized error response format for the Rezepta Backend API and provides examples for all possible error scenarios.

## Error Response Format

### Standard Error Response
```json
{
  "error": {
    "errorCode": "ERROR_CODE",
    "message": "Human readable error message",
    "status": "fail|error",
    "path": "/api/endpoint",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-123",
    "details": [] // Optional array of detailed error information
  }
}
```

## Authentication Endpoints

### POST /auth/login

#### Invalid Credentials
```json
{
  "error": {
    "errorCode": "AUTHENTICATION_ERROR",
    "message": "Invalid email or password",
    "status": "fail",
    "path": "/auth/login",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-123"
  }
}
```

#### Account Locked
```json
{
  "error": {
    "errorCode": "ACCOUNT_LOCKED",
    "message": "Account temporarily locked due to multiple failed attempts",
    "status": "fail",
    "path": "/auth/login",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-124"
  }
}
```

### POST /auth/register

#### Validation Error
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
    "requestId": "req-125"
  }
}
```

#### Duplicate Email
```json
{
  "error": {
    "errorCode": "CONFLICT_ERROR",
    "message": "Email already registered",
    "status": "fail",
    "path": "/auth/register",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-126"
  }
}
```

## Recipe Endpoints

### GET /recipes/{id}

#### Recipe Not Found
```json
{
  "error": {
    "errorCode": "NOT_FOUND_ERROR",
    "message": "Recipe not found",
    "status": "fail",
    "path": "/recipes/123",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-127"
  }
}
```

### POST /recipes

#### Unauthorized Access
```json
{
  "error": {
    "errorCode": "AUTHORIZATION_ERROR",
    "message": "Not authorized to create recipes",
    "status": "fail",
    "path": "/recipes",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-128"
  }
}
```

#### Invalid Recipe Data
```json
{
  "error": {
    "errorCode": "VALIDATION_ERROR",
    "message": "Invalid recipe data",
    "status": "fail",
    "details": [
      {
        "field": "title",
        "message": "Title is required"
      },
      {
        "field": "ingredients",
        "message": "At least one ingredient is required"
      }
    ],
    "path": "/recipes",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-129"
  }
}
```

## User Endpoints

### GET /users/{id}

#### User Not Found
```json
{
  "error": {
    "errorCode": "NOT_FOUND_ERROR",
    "message": "User not found",
    "status": "fail",
    "path": "/users/123",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-130"
  }
}
```

### PUT /users/{id}

#### Invalid Update Data
```json
{
  "error": {
    "errorCode": "VALIDATION_ERROR",
    "message": "Invalid user data",
    "status": "fail",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "path": "/users/123",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-131"
  }
}
```

## Search Endpoints

### GET /search

#### Search Error
```json
{
  "error": {
    "errorCode": "SEARCH_ERROR",
    "message": "Search service temporarily unavailable",
    "status": "error",
    "path": "/search",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-132"
  }
}
```

## Rate Limiting

### Rate Limit Exceeded
```json
{
  "error": {
    "errorCode": "RATE_LIMIT_ERROR",
    "message": "Too many requests",
    "status": "fail",
    "path": "/api/endpoint",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-133",
    "details": {
      "retryAfter": 60,
      "limit": 100,
      "windowSize": "15m"
    }
  }
}
```

## System Errors

### Database Error
```json
{
  "error": {
    "errorCode": "DATABASE_ERROR",
    "message": "Database operation failed",
    "status": "error",
    "path": "/api/endpoint",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-134"
  }
}
```

### Integration Error
```json
{
  "error": {
    "errorCode": "INTEGRATION_ERROR",
    "message": "External service unavailable",
    "status": "error",
    "path": "/api/endpoint",
    "timestamp": "2023-12-10T12:00:00.000Z",
    "requestId": "req-135"
  }
}
```

## Error Codes Reference

### Authentication Errors (401, 403)
- `AUTHENTICATION_ERROR`: Authentication failed
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `INVALID_TOKEN`: Invalid or expired token
- `ACCOUNT_LOCKED`: Account temporarily locked

### Validation Errors (400)
- `VALIDATION_ERROR`: Invalid input data
- `INVALID_FORMAT`: Data format error
- `MISSING_FIELD`: Required field missing
- `INVALID_VALUE`: Invalid field value

### Resource Errors (404, 409)
- `NOT_FOUND_ERROR`: Resource not found
- `CONFLICT_ERROR`: Resource conflict
- `ALREADY_EXISTS`: Resource already exists
- `RESOURCE_LOCKED`: Resource locked

### System Errors (500)
- `DATABASE_ERROR`: Database operation failed
- `CACHE_ERROR`: Cache operation failed
- `INTEGRATION_ERROR`: External service error
- `PERFORMANCE_ERROR`: Performance threshold exceeded

### Rate Limiting (429)
- `RATE_LIMIT_ERROR`: Too many requests
- `QUOTA_EXCEEDED`: API quota exceeded

## HTTP Status Codes

- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Authentication errors
- `403 Forbidden`: Authorization errors
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflicts
- `429 Too Many Requests`: Rate limiting
- `500 Internal Server Error`: System errors
- `502 Bad Gateway`: Integration errors
- `503 Service Unavailable`: Service unavailable
- `504 Gateway Timeout`: Request timeout 