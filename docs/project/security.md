# Security Best Practices

## Overview
This document outlines security best practices for the Rezepta Backend application, covering authentication, authorization, data protection, and secure coding guidelines.

## Authentication

### JWT Implementation
```javascript
// Use strong secret keys
JWT_SECRET=<at-least-64-characters-random-string>

// Set appropriate expiration
const token = jwt.sign(payload, process.env.JWT_SECRET, {
  expiresIn: '24h',
  algorithm: 'HS256'
});

// Implement refresh token mechanism
const refreshToken = jwt.sign(
  { userId: user.id },
  process.env.REFRESH_TOKEN_SECRET,
  { expiresIn: '7d' }
);
```

### Password Security
- Use bcrypt for password hashing (cost factor 12+)
- Implement password complexity requirements:
  - Minimum 8 characters
  - Mix of uppercase, lowercase, numbers, symbols
- Enforce password change on security events
- Store only hashed passwords, never plaintext

### Session Management
- Use secure session configuration:
  ```javascript
  app.use(session({
    secret: process.env.SESSION_SECRET,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    },
    resave: false,
    saveUninitialized: false
  }));
  ```
- Implement session timeout
- Rotate session IDs after login
- Clear sessions on logout

## Authorization

### Role-Based Access Control (RBAC)
```javascript
const roles = {
  USER: ['read:recipes', 'create:recipe', 'update:own_recipe'],
  ADMIN: ['read:recipes', 'create:recipe', 'update:any_recipe', 'delete:any_recipe']
};

const checkPermission = (user, permission) => {
  return roles[user.role].includes(permission);
};
```

### API Security
- Implement rate limiting
- Use API keys for external services
- Validate all input parameters
- Implement request size limits

## Data Protection

### Encryption
- Use TLS 1.3 for data in transit
- Encrypt sensitive data at rest
- Secure key management:
  ```javascript
  // Use environment variables for sensitive data
  const encryption = {
    algorithm: 'aes-256-gcm',
    key: process.env.ENCRYPTION_KEY,
    iv: crypto.randomBytes(16)
  };
  ```

### Data Validation
```javascript
// Sanitize user input
const sanitizeInput = (data) => {
  return {
    ...data,
    title: xss(data.title),
    description: xss(data.description)
  };
};

// Validate request parameters
const validateRecipe = (recipe) => {
  if (!recipe.title || recipe.title.length < 3) {
    throw new ValidationError('Invalid title');
  }
  // Additional validation...
};
```

## Secure Headers
```javascript
// Use Helmet for secure headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  referrerPolicy: { policy: 'same-origin' }
}));
```

## Error Handling
- Never expose stack traces in production
- Use generic error messages for sensitive operations
- Log security events securely
```javascript
// Secure error responses
const handleError = (err, res) => {
  logger.error('Security event:', {
    error: err.message,
    userId: req.user?.id,
    ip: req.ip
  });
  
  res.status(err.status || 500).json({
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'An error occurred' 
        : err.message
    }
  });
};
```

## Database Security

### MongoDB Security
```javascript
// Secure connection string
mongodb://${username}:${password}@${host}:${port}/${database}?authSource=admin&ssl=true

// Enable authentication
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  ssl: true,
  authSource: 'admin'
});
```

### Query Safety
- Use parameterized queries
- Implement query timeout limits
- Validate database inputs
```javascript
// Safe query example
const findRecipe = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError('Invalid ID');
  }
  return Recipe.findById(id).select('-__v');
};
```

## File Upload Security
- Validate file types
- Implement file size limits
- Scan for malware
- Store files securely
```javascript
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Invalid file type'));
    }
    cb(null, true);
  }
});
```

## Security Monitoring

### Logging
```javascript
// Security event logging
const logSecurityEvent = (event) => {
  logger.warn('Security event', {
    event,
    timestamp: new Date(),
    ip: req.ip,
    user: req.user?.id,
    path: req.path
  });
};
```

### Alerts
- Monitor for suspicious activities
- Set up alerts for:
  - Failed login attempts
  - Unusual API usage patterns
  - Database query patterns
  - File upload anomalies

## Deployment Security
- Use secure environment variables
- Implement CI/CD security scanning
- Regular security updates
- Maintain security headers
```yaml
# Security headers in nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

## Security Checklist

### Development
- [ ] Use security linters
- [ ] Regular dependency updates
- [ ] Code review security checks
- [ ] Automated security testing

### Deployment
- [ ] Secure configuration
- [ ] Environment variable protection
- [ ] Infrastructure security
- [ ] Monitoring setup

### Maintenance
- [ ] Regular security audits
- [ ] Incident response plan
- [ ] Security patch management
- [ ] Access review process 