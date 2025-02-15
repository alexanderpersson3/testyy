# Rezepta Backend

A modern, scalable backend for the Rezepta recipe management and shopping platform.

## Features

- 🍳 Recipe Management
- 🛒 Shopping Lists
- 🏪 Store Management
- 👥 User Management
- 🔍 Advanced Search
- 📊 Analytics & Statistics

## Tech Stack

- Node.js & TypeScript
- MongoDB
- Elasticsearch
- Socket.IO
- Express.js
- Winston Logger

## Prerequisites

- Node.js >= 16
- MongoDB >= 5.0
- Elasticsearch >= 7.0
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/rezepta-backend.git
   cd rezepta-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file:
   ```env
   # Database
   MONGODB_URL=mongodb://localhost:27017
   DB_NAME=rezepta
   DB_MAX_POOL_SIZE=10
   DB_MIN_POOL_SIZE=5

   # Security
   JWT_SECRET=your-secret-key
   JWT_EXPIRATION=24h
   BCRYPT_ROUNDS=10

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100

   # Elasticsearch
   ELASTICSEARCH_NODE=http://localhost:9200
   ELASTICSEARCH_INDEX_PREFIX=rezepta

   # Logging
   LOG_LEVEL=info

   # CORS
   CORS_ORIGIN=*
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── core/               # Core functionality
│   ├── database/      # Database connection and utilities
│   ├── errors/        # Custom error classes
│   ├── services/      # Core services (WebSocket, etc.)
│   └── utils/         # Utility functions
├── features/          # Feature modules
│   ├── recipe/        # Recipe management
│   ├── shopping/      # Shopping lists and stores
│   ├── user/          # User management
│   └── ...
├── middleware/        # Express middleware
├── config.ts          # Configuration
└── index.ts          # Application entry point
```

## API Documentation

API documentation is available at `/api-docs` when running the server.

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Express.js](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [Elasticsearch](https://www.elastic.co/)
- [Socket.IO](https://socket.io/)
