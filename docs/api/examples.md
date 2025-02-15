# API Examples

## Authentication

### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

### Register
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "name": "Jane Smith"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439012",
    "email": "newuser@example.com",
    "name": "Jane Smith",
    "role": "user"
  }
}
```

## Recipes

### List Recipes
```http
GET /api/v1/recipes?page=1&limit=10&category=dinner
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:
```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439013",
      "title": "Spaghetti Carbonara",
      "description": "Classic Italian pasta dish",
      "ingredients": [
        {
          "name": "spaghetti",
          "amount": 400,
          "unit": "g"
        },
        {
          "name": "eggs",
          "amount": 4,
          "unit": "pieces"
        }
      ],
      "instructions": [
        {
          "step": 1,
          "description": "Boil pasta in salted water"
        }
      ],
      "category": "dinner",
      "preparationTime": 30,
      "difficulty": "medium",
      "servings": 4,
      "author": {
        "id": "507f1f77bcf86cd799439011",
        "name": "John Doe"
      },
      "averageRating": 4.5
    }
  ],
  "pagination": {
    "total": 100,
    "pages": 10,
    "current": 1
  }
}
```

### Create Recipe
```http
POST /api/v1/recipes
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "title": "Chocolate Cake",
  "description": "Rich and moist chocolate cake",
  "ingredients": [
    {
      "name": "flour",
      "amount": 250,
      "unit": "g"
    },
    {
      "name": "sugar",
      "amount": 200,
      "unit": "g"
    },
    {
      "name": "cocoa powder",
      "amount": 50,
      "unit": "g"
    }
  ],
  "instructions": [
    {
      "step": 1,
      "description": "Preheat oven to 180°C"
    },
    {
      "step": 2,
      "description": "Mix dry ingredients"
    }
  ],
  "category": "dessert",
  "preparationTime": 60,
  "difficulty": "medium",
  "servings": 8,
  "tags": ["chocolate", "cake", "dessert"]
}
```

Response:
```json
{
  "id": "507f1f77bcf86cd799439014",
  "title": "Chocolate Cake",
  "description": "Rich and moist chocolate cake",
  "ingredients": [
    {
      "name": "flour",
      "amount": 250,
      "unit": "g"
    },
    {
      "name": "sugar",
      "amount": 200,
      "unit": "g"
    },
    {
      "name": "cocoa powder",
      "amount": 50,
      "unit": "g"
    }
  ],
  "instructions": [
    {
      "step": 1,
      "description": "Preheat oven to 180°C"
    },
    {
      "step": 2,
      "description": "Mix dry ingredients"
    }
  ],
  "category": "dessert",
  "preparationTime": 60,
  "difficulty": "medium",
  "servings": 8,
  "author": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe"
  },
  "tags": ["chocolate", "cake", "dessert"],
  "averageRating": 0,
  "createdAt": "2024-03-15T12:00:00.000Z"
}
```

### Get Recipe
```http
GET /api/v1/recipes/507f1f77bcf86cd799439014
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:
```json
{
  "id": "507f1f77bcf86cd799439014",
  "title": "Chocolate Cake",
  "description": "Rich and moist chocolate cake",
  "ingredients": [
    {
      "name": "flour",
      "amount": 250,
      "unit": "g"
    },
    {
      "name": "sugar",
      "amount": 200,
      "unit": "g"
    },
    {
      "name": "cocoa powder",
      "amount": 50,
      "unit": "g"
    }
  ],
  "instructions": [
    {
      "step": 1,
      "description": "Preheat oven to 180°C"
    },
    {
      "step": 2,
      "description": "Mix dry ingredients"
    }
  ],
  "category": "dessert",
  "preparationTime": 60,
  "difficulty": "medium",
  "servings": 8,
  "author": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe"
  },
  "tags": ["chocolate", "cake", "dessert"],
  "averageRating": 4.5,
  "ratings": [
    {
      "user": {
        "id": "507f1f77bcf86cd799439012",
        "name": "Jane Smith"
      },
      "score": 4.5,
      "comment": "Great recipe!",
      "date": "2024-03-15T12:30:00.000Z"
    }
  ],
  "createdAt": "2024-03-15T12:00:00.000Z"
}
```

### Update Recipe
```http
PUT /api/v1/recipes/507f1f77bcf86cd799439014
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "title": "Ultimate Chocolate Cake",
  "preparationTime": 45,
  "ingredients": [
    {
      "name": "flour",
      "amount": 300,
      "unit": "g"
    }
  ]
}
```

Response:
```json
{
  "id": "507f1f77bcf86cd799439014",
  "title": "Ultimate Chocolate Cake",
  "preparationTime": 45,
  "ingredients": [
    {
      "name": "flour",
      "amount": 300,
      "unit": "g"
    }
  ],
  "updatedAt": "2024-03-15T13:00:00.000Z"
}
```

### Rate Recipe
```http
POST /api/v1/recipes/507f1f77bcf86cd799439014/rate
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "score": 4.5,
  "comment": "Great recipe!"
}
```

Response:
```json
{
  "id": "507f1f77bcf86cd799439014",
  "averageRating": 4.5,
  "ratings": [
    {
      "user": {
        "id": "507f1f77bcf86cd799439012",
        "name": "Jane Smith"
      },
      "score": 4.5,
      "comment": "Great recipe!",
      "date": "2024-03-15T13:30:00.000Z"
    }
  ]
}
```

## Search

### Search Recipes
```http
GET /api/v1/search?q=chocolate&page=1&limit=10
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:
```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439014",
      "title": "Ultimate Chocolate Cake",
      "description": "Rich and moist chocolate cake",
      "category": "dessert",
      "averageRating": 4.5,
      "author": {
        "id": "507f1f77bcf86cd799439011",
        "name": "John Doe"
      }
    }
  ],
  "pagination": {
    "total": 50,
    "pages": 5,
    "current": 1
  }
}
```

## Error Examples

### Invalid Input
```http
POST /api/v1/recipes
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "title": "",
  "description": "Invalid recipe"
}
```

Response:
```json
{
  "error": {
    "errorCode": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "status": "fail",
    "path": "/api/v1/recipes",
    "timestamp": "2024-03-15T14:00:00.000Z",
    "requestId": "req-123",
    "details": [
      {
        "field": "title",
        "message": "Title is required"
      },
      {
        "field": "ingredients",
        "message": "At least one ingredient is required"
      }
    ]
  }
}
```

### Unauthorized Access
```http
GET /api/v1/recipes
```

Response:
```json
{
  "error": {
    "errorCode": "AUTHENTICATION_ERROR",
    "message": "Authentication required",
    "status": "fail",
    "path": "/api/v1/recipes",
    "timestamp": "2024-03-15T14:30:00.000Z",
    "requestId": "req-124"
  }
}
```

### Resource Not Found
```http
GET /api/v1/recipes/invalid-id
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:
```json
{
  "error": {
    "errorCode": "NOT_FOUND_ERROR",
    "message": "Recipe not found",
    "status": "fail",
    "path": "/api/v1/recipes/invalid-id",
    "timestamp": "2024-03-15T15:00:00.000Z",
    "requestId": "req-125"
  }
}
```

### Rate Limit Exceeded
```http
GET /api/v1/recipes
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:
```json
{
  "error": {
    "errorCode": "RATE_LIMIT_ERROR",
    "message": "Too many requests",
    "status": "fail",
    "path": "/api/v1/recipes",
    "timestamp": "2024-03-15T15:30:00.000Z",
    "requestId": "req-126",
    "details": {
      "retryAfter": 60,
      "limit": 100,
      "windowSize": "15m"
    }
  }
}
``` 