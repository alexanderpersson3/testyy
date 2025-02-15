# Rezepta Backend Architecture Documentation

## 1. System Overview
```ascii
[Client] → [Load Balancer] → [Cloud Run] → [Backend Services]
                │               │
                ↓               ↓
        [Cloud CDN]       [Cloud SQL (MongoDB)]
                             [Memorystore (Redis)]
                             [Cloud Storage]
                             [Cloud Tasks]
```

## 2. Technical Stack
### Core Components
| Component          | Technology             | Version |
|--------------------|------------------------|---------|
| Runtime            | Node.js                | 18.x    |
| Framework          | Express.js             | 4.x     |
| Database           | MongoDB                | 6.x     |
| Search             | Elasticsearch          | 8.x     |
| Cache              | Redis                  | 7.x     |
| Validation         | Zod                    | 3.24    |
| Security           | Helmet, CORS           | latest  |

### Key Dependencies (from package.json)
```json
{
  "core": [
    "@elastic/elasticsearch", 
    "mongoose", 
    "jsonwebtoken",
    "zod"
  ],
  "google-cloud": [
    "@google-cloud/storage",
    "@google-cloud/tasks",
    "@google-cloud/logging"
  ],
  "testing": [
    "jest", 
    "mocha",
    "supertest"
  ]
}
```

## 3. Architectural Patterns
### Code Structure Analysis
```
src/
├── config/          # Environment configuration
├── middleware/      # Express middleware chain
│   ├── auth.js      # JWT validation
│   ├── rate-limit.js# Request throttling
│   └── error-handler.js # Central error handling
├── routes/          # API endpoint definitions
│   ├── auth/        # Authentication routes
│   ├── recipes/     # Recipe management
│   └── social/      # Social features
└── services/        # Business logic
    ├── search/      # Elasticsearch integration
    ├── email/       # Nodemailer integration
    └── analytics/   # Monitoring logic
```

## 4. Core Module Matrix
| Module          | Responsibility                      | Key Dependencies        |
|-----------------|-------------------------------------|-------------------------|
| Auth Service    | JWT generation/validation           | bcryptjs, jsonwebtoken  |
| Search Service  | Elasticsearch query composition     | @elastic/elasticsearch  |
| Queue System    | Background job processing           | Bull (Redis)            |
| Media Service   | Image/video processing              | @google-cloud/storage   |
| Price Tracker   | Ingredient price synchronization    | node-schedule, axios    |

## 5. Data Flow Diagram
```ascii
          ┌─────────────┐
          │   Client    │
          └──────┬──────┘
                 │ HTTP
          ┌──────▼──────┐
          │  API Layer  │
          │  (Express)  │
          └──────┬──────┘
         ┌───────┴───────┐
         │  Service Layer │
         └───────┬───────┘
    ┌────────────┼────────────┐
┌───▼───┐    ┌───▼───┐    ┌───▼───┐
│ MongoDB│    │ Redis │    │Elastic│
└───────┘    └───────┘    └───────┘
```

## 6. Security Architecture
### Defense-in-Depth Layers
1. **Cloud Armor**: WAF ruleset filtering
2. **Rate Limiting**: 100 req/15min (user), 300 req/min (admin)
3. **JWT Validation**: HMAC SHA-256 with 24h expiration
4. **Input Sanitization**: Zod schema validation
5. **Database Isolation**: Separate read/write users

## 7. Key Anti-Patterns
1. **Monolithic Service**  
   All features in single codebase - consider microservices
2. **Direct DB Access**  
   Services access MongoDB directly - add repository layer
3. **Synchronous Price Checks**  
   Matspar.se API calls in request flow - move to queue

## 8. Future Considerations
1. **Caching Strategy**  
   Add Redis caching for frequent recipe queries
2. **Search Optimization**  
   Implement search-as-you-type with edge n-grams
3. **Observability**  
   Add OpenTelemetry instrumentation
4. **CI/CD**  
   Implement canary deployments via Cloud Build

## 9. Operational Metrics
| Metric                | Threshold        | Alert Channel |
|-----------------------|------------------|---------------|
| API Latency (p95)     | > 2000ms         | PagerDuty     |
| MongoDB Connections   | > 80% pool usage | Slack         |
| Redis Memory          | > 75% utilization| Email         |
| Error Rate            | > 5% (5m window) | SMS           |

## 10. Dependency Graph
```ascii
                 ┌───────────┐
                 │   Auth    │
                 └─────┬─────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Recipe Service │ │ Search Service │ │ Notification │
└───────┬─────┘ └──────┬─────┘ └──────┬─────┘
        │               │              │
        ▼               ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   MongoDB    │ │ Elasticsearch │ │    Redis     │
└─────────────┘ └─────────────┘ └─────────────┘
```

Note: Missing Swagger documentation (listed in README future enhancements)