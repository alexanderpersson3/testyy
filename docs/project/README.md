# Rezepta Backend Documentation

## Overview
Rezepta Backend is a robust API service for managing recipes, user accounts, and related functionality. This documentation provides comprehensive information about the project architecture, setup, and development guidelines.

## Table of Contents
1. [Architecture](#architecture)
2. [Getting Started](#getting-started)
3. [Development](#development)
4. [Deployment](#deployment)
5. [API Reference](#api-reference)
6. [Error Handling](#error-handling)
7. [Monitoring](#monitoring)

## Architecture

### System Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API Gateway   │────▶│  Load Balancer  │────▶│   Application   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │    Database     │
                                               └─────────────────┘
```

### Key Components
- **API Gateway**: Handles authentication, rate limiting, and request routing
- **Load Balancer**: Distributes traffic across application instances
- **Application**: Node.js/Express backend service
- **Database**: MongoDB for data persistence
- **Cache**: Redis for performance optimization
- **Message Queue**: RabbitMQ for asynchronous processing

### Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB
- **Cache**: Redis
- **Message Queue**: RabbitMQ
- **Testing**: Jest
- **Documentation**: OpenAPI/Swagger
- **Monitoring**: Google Cloud Monitoring

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB 5+
- Redis 6+
- RabbitMQ 3.9+

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/rezepta-backend.git
   cd rezepta-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| NODE_ENV | Environment | development |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/rezepta |
| REDIS_URL | Redis connection string | redis://localhost:6379 |
| JWT_SECRET | JWT signing key | - |
| API_KEY | External API key | - |

## Development

### Project Structure
```
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Custom middleware
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   └── app.js         # Application entry
├── tests/             # Test files
├── docs/              # Documentation
└── scripts/           # Utility scripts
```

### Code Style
- Follow ESLint configuration
- Use async/await for asynchronous operations
- Implement error handling using custom error classes
- Write unit tests for all business logic
- Document all public APIs and functions

### Git Workflow
1. Create feature branch from develop
2. Make changes and commit
3. Submit pull request
4. Code review and automated tests
5. Merge to develop

## Deployment

### Production Setup
1. Build application:
   ```bash
   npm run build
   ```

2. Configure production environment:
   ```bash
   # Set production environment variables
   export NODE_ENV=production
   export PORT=3000
   ```

3. Start application:
   ```bash
   npm start
   ```

### Docker Deployment
1. Build image:
   ```bash
   docker build -t rezepta-backend .
   ```

2. Run container:
   ```bash
   docker run -p 3000:3000 rezepta-backend
   ```

### Cloud Deployment
- Supports deployment to Google Cloud Run
- Automated deployment using GitHub Actions
- Infrastructure as Code using Terraform

## API Reference
Detailed API documentation is available at:
- Development: http://localhost:3000/api-docs
- Production: https://api.rezepta.com/api-docs

## Error Handling
See [Error Handling Documentation](../error-handling.md) for details on:
- Error response format
- Error types and codes
- Error handling best practices
- Troubleshooting guide

## Monitoring
See [Monitoring Setup](../error-monitoring-setup.md) for details on:
- Performance monitoring
- Error tracking
- Alerting configuration
- Dashboard setup 