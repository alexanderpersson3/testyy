# Rezepta Backend API

A modern, TypeScript-based backend service for recipe management with real-time price comparison across Swedish grocery stores.

## Features

- 🔐 **Social Authentication**: Support for Google, Facebook, and Apple login
- 💰 **Real-time Price Comparison**: Live price scraping from major Swedish grocery stores
- 🏪 **Store Integration**: Support for Willys, ICA, Coop, and Matspar
- 🚀 **Performance Optimized**: Redis caching and rate limiting
- 🔍 **Smart Search**: Recipe search with filtering by difficulty, diet type, and price range
- 📊 **Price Analytics**: Historical price tracking and best deal recommendations

## Tech Stack

- Node.js & Express
- TypeScript
- MongoDB
- Redis
- Zod (Schema Validation)
- Jest (Testing)

## Prerequisites

- Node.js 18+
- MongoDB 5+
- Redis 6+

## Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rezepta

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Authentication
GOOGLE_CLIENT_ID=your_google_client_id
FACEBOOK_APP_ID=your_facebook_app_id
APPLE_CLIENT_ID=your_apple_client_id
JWT_SECRET=your_jwt_secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/rezepta-backend.git
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

4. Start the development server:
```bash
npm run dev
```

## API Documentation

### Authentication

#### Social Login
```http
POST /api/auth/social-login
Content-Type: application/json

{
  "provider": "google" | "facebook" | "apple",
  "token": "string"
}
```

### Store Prices

#### Get Recipe Prices
```http
GET /api/recipes/:recipeId/prices?store=Willys,Ica,Coop,Matspar
```

### Recipe Details

#### Get Recipe Details
```http
GET /api/recipes/:recipeId
```

## Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
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

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Environment Variables
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/rezepta
JWT_SECRET=your-jwt-secret
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

### Installation
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Start production server
npm start
```

### Testing
The backend includes a comprehensive test suite using Mocha and Chai:
- Unit tests for services
- Integration tests for API endpoints
- Mock database for testing
- Test coverage reporting

## Architecture

### Directory Structure
```
├── config/         # Configuration files
├── middleware/     # Express middleware
├── routes/         # API routes
├── services/       # Business logic
├── tests/          # Test files
├── app.js         # Express app setup
└── server.js      # Server entry point
```

### Key Components
- **Error Handler**: Centralized error handling with appropriate status codes
- **Security Middleware**: Rate limiting, CORS, and security headers
- **Database Layer**: MongoDB connection with proper error handling
- **Service Layer**: Business logic separation for maintainability

## Production Considerations

### Security
- Rate limiting to prevent abuse
- CORS configuration for allowed origins
- Security headers for common vulnerabilities
- Input validation for all endpoints

### Performance
- Database connection pooling
- Rate limiting for API stability
- Efficient ingredient search queries

### Reliability
- Graceful shutdown handling
- Health check endpoint
- Comprehensive error handling
- Database connection management

## Future Enhancements
- API documentation (Swagger)
- Advanced monitoring integration
- Caching layer
- WebSocket support for real-time updates
- Enhanced analytics capabilities

# API Documentation

### Base URL:
`http://34.88.118.0:3000/api`


### Endpoints

### 1. Get Recipe Store Prices
- **URL:** `/recipes/store-prices`
- **Method:** `GET`
- **Description:** Fetches the price comparison of ingredients for a specific recipe from a specific store.
- **Query Parameters:**
  - `recipeId` (required): The ID of the recipe to fetch ingredient prices for.
  - `store` (required): The name of the store to filter ingredient prices.
- **Response:**
  - `success` (boolean): Status of the request.
  - `data` (object): Includes:
    - Store name
    - Logo
    - Ingredient details (name, price, unit, etc.)
    - Total prices
  - `message` (string): Error details, if any.


### 2. Get Recipe Details
- **URL:** `/recipes/:recipeId`
- **Method:** `GET`
- **Description:** Retrieves detailed information about a recipe, including nutrition, ingredients, and store comparisons.
- **Path Parameters:**
  - `recipeId` (required): The ID of the recipe to fetch details for.
- **Response:**
  - `success` (boolean): Status of the request.
  - `response` (object): Contains:
    - Recipe details
    - Nutrition information
    - Store data (top 3 stores based on price)
    - Featured ingredients
  - `message` (string): Error details, if any.

---

### Example Requests

#### 1. Get Store Prices
```http
GET http://34.88.118.0:3000/api/recipes/store-prices?recipeId=676408a0a74d2f13bd57c758&store=Mathem
```

#### 2. Get Recipe Details
```http
GET http://34.88.118.0:3000/api/recipes/676408a0a74d2f13bd57c758
```

