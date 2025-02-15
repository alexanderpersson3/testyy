# Rezepta Backend Architecture

## System Overview
The Rezepta backend is built on Google Cloud Platform using Cloud Run for containerized services, with the following key components:

### Core Infrastructure
- **VPC Network**: Private network with custom subnets and Cloud NAT
- **Cloud CDN**: Content delivery for static assets and caching
- **Cloud Tasks**: Background job processing for emails, notifications, and analytics

### Data Storage
- **MongoDB**: Primary database for user data, recipes, and application state
- **Elasticsearch**: Search engine for recipes and ingredients
- **Redis**: Caching and job queue management
- **Cloud Storage**: Media storage for recipe images and user uploads

### Request/Response Flow
1. **Client Request** → Load Balancer → Cloud Armor (WAF)
2. **Authentication** → JWT validation → Role checking
3. **API Processing** → Business logic → Database operations
4. **Response** → CDN caching → Client

## Data Models

### User Model
```javascript
{
  _id: ObjectId,
  email: String,
  username: String,
  passwordHash: String,
  profile: {
    displayName: String,
    bio: String,
    avatar: String
  },
  subscription: {
    status: String,
    plan: String,
    expiresAt: Date
  },
  preferences: {
    cuisine: [String],
    dietary: [String],
    notifications: Object
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Recipe Model
```javascript
{
  _id: ObjectId,
  title: String,
  author: ObjectId,
  ingredients: [{
    item: ObjectId,
    amount: Number,
    unit: String
  }],
  instructions: [String],
  metadata: {
    prepTime: Number,
    cookTime: Number,
    difficulty: String,
    cuisine: String
  },
  media: {
    images: [String],
    video: String
  },
  stats: {
    views: Number,
    likes: Number,
    shares: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Product/Price Model
```javascript
{
  _id: ObjectId,
  name: String,
  store: ObjectId,
  category: String,
  currentPrice: Number,
  priceHistory: [{
    price: Number,
    date: Date
  }],
  deals: [{
    type: String,
    discount: Number,
    validUntil: Date
  }],
  updatedAt: Date
}
```

## Environment Configuration

### Development
- Local MongoDB instance
- Local Elasticsearch
- Local Redis
- Mocked Cloud services
- `.env.development`

### Staging
- Cloud SQL (MongoDB)
- Elasticsearch Service
- Memory Store (Redis)
- Full Cloud integration
- `.env.staging`

### Production
- Replicated MongoDB cluster
- Production Elasticsearch cluster
- High-availability Redis
- Production Cloud services
- `.env.production`

## Security

### Authentication Flow
1. User login/registration
2. JWT token generation with roles
3. Token validation middleware
4. Role-based access control

### API Security
- Cloud Armor WAF protection
- Rate limiting
- Input validation
- SQL injection prevention
- XSS protection

## Monitoring & Logging

### Metrics Collection
- Request latency
- Error rates
- Queue depths
- Cache hit ratios
- Database performance

### Logging
- Structured logging
- Error tracking
- Audit trails
- Performance monitoring

## Deployment

### CI/CD Pipeline
1. Code push triggers Cloud Build
2. Run tests and linting
3. Build container image
4. Deploy to Cloud Run
5. Update CDN configuration

### Rollback Procedure
1. Identify failing deployment
2. Revert to last known good image
3. Update service configuration
4. Verify health checks
5. Clear CDN cache if needed 