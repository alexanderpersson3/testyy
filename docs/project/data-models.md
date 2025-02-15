# Data Models Documentation

## Overview
This document describes the data models used in the Rezepta Backend application, including their schemas, relationships, and validation rules.

## Models

### User
```javascript
{
  email: {
    type: String,
    required: true,
    unique: true,
    validate: [isEmail, 'Invalid email format']
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: Date,
  isActive: {
    type: Boolean,
    default: true
  }
}
```

### Recipe
```javascript
{
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  ingredients: [{
    name: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      required: true
    }
  }],
  instructions: [{
    step: Number,
    description: String
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'dessert', 'snack'],
    required: true
  },
  preparationTime: {
    type: Number,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true
  },
  servings: {
    type: Number,
    required: true
  },
  tags: [String],
  images: [{
    url: String,
    caption: String
  }],
  ratings: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}
```

### Category
```javascript
{
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  image: String,
  recipes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe'
  }]
}
```

### Comment
```javascript
{
  recipe: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}
```

## Relationships

### User Relationships
- One-to-Many with Recipe (author)
- One-to-Many with Comment
- Many-to-Many with Recipe (ratings)

### Recipe Relationships
- Many-to-One with User (author)
- One-to-Many with Comment
- Many-to-Many with User (ratings)
- Many-to-One with Category

### Category Relationships
- One-to-Many with Recipe

### Comment Relationships
- Many-to-One with Recipe
- Many-to-One with User
- Many-to-Many with User (likes)

## Indexes

### User Indexes
```javascript
{
  email: 1,        // Unique index
  createdAt: -1    // Date-based queries
}
```

### Recipe Indexes
```javascript
{
  author: 1,       // Author queries
  category: 1,     // Category filtering
  tags: 1,         // Tag-based searches
  createdAt: -1    // Date-based queries
}
```

### Category Indexes
```javascript
{
  name: 1          // Unique index
}
```

### Comment Indexes
```javascript
{
  recipe: 1,       // Recipe-based queries
  user: 1,         // User-based queries
  createdAt: -1    // Date-based queries
}
```

## Validation Rules

### User Validation
- Email must be unique and valid format
- Password must be at least 8 characters
- Name is required
- Role must be either 'user' or 'admin'

### Recipe Validation
- Title and description are required
- At least one ingredient is required
- Each ingredient must have name, amount, and unit
- Preparation time must be positive number
- Difficulty must be 'easy', 'medium', or 'hard'
- Servings must be positive number
- Rating score must be between 1 and 5

### Category Validation
- Name must be unique
- Name is required

### Comment Validation
- Content is required
- Recipe reference is required
- User reference is required

## Data Migration Guidelines

### Version Control
- Use semantic versioning for schema changes
- Document migration scripts in `migrations/` directory
- Test migrations on staging before production

### Backward Compatibility
- Maintain backward compatibility when possible
- Document breaking changes
- Provide migration path for clients

### Data Integrity
- Validate data before and after migration
- Create backup before migration
- Log all migration operations 