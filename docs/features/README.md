# Additional Features Documentation

## Overview
This document outlines the implementation details of additional features in the Rezepta Backend application.

## Table of Contents
1. [Search](#search)
2. [Notifications](#notifications)
3. [Social Features](#social-features)
4. [Gamification](#gamification)
5. [Internationalization](#internationalization)
6. [Accessibility](#accessibility)

## Search

### Elasticsearch Integration
```javascript
// Configuration
const elasticsearch = require('@elastic/elasticsearch');
const client = new elasticsearch.Client({
  node: process.env.ELASTICSEARCH_URL,
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD
  }
});

// Recipe index mapping
const recipeMapping = {
  mappings: {
    properties: {
      title: { 
        type: 'text',
        analyzer: 'standard',
        fields: {
          keyword: { type: 'keyword' }
        }
      },
      description: { type: 'text' },
      ingredients: {
        type: 'nested',
        properties: {
          name: { type: 'text' },
          amount: { type: 'float' },
          unit: { type: 'keyword' }
        }
      },
      tags: { type: 'keyword' },
      category: { type: 'keyword' },
      difficulty: { type: 'keyword' },
      preparationTime: { type: 'integer' },
      averageRating: { type: 'float' }
    }
  }
};

// Search implementation
const searchRecipes = async (query, filters) => {
  const searchQuery = {
    bool: {
      must: [
        {
          multi_match: {
            query,
            fields: ['title^2', 'description', 'ingredients.name']
          }
        }
      ],
      filter: []
    }
  };

  // Apply filters
  if (filters.category) {
    searchQuery.bool.filter.push({ term: { category: filters.category } });
  }
  if (filters.difficulty) {
    searchQuery.bool.filter.push({ term: { difficulty: filters.difficulty } });
  }
  if (filters.minRating) {
    searchQuery.bool.filter.push({ range: { averageRating: { gte: filters.minRating } } });
  }

  const result = await client.search({
    index: 'recipes',
    body: {
      query: searchQuery,
      sort: [
        { _score: 'desc' },
        { averageRating: 'desc' }
      ],
      highlight: {
        fields: {
          title: {},
          description: {}
        }
      }
    }
  });

  return result.hits;
};
```

### Search Features
- Full-text search across recipes
- Ingredient-based search
- Category and tag filtering
- Difficulty level filtering
- Preparation time range filtering
- Rating-based filtering
- Search result highlighting
- Autocomplete suggestions
- Fuzzy matching for typos
- Relevance scoring

## Notifications

### Notification System
```javascript
// Notification types
const NotificationType = {
  NEW_RECIPE: 'new_recipe',
  NEW_COMMENT: 'new_comment',
  NEW_RATING: 'new_rating',
  PRICE_ALERT: 'price_alert',
  ACHIEVEMENT: 'achievement',
  FOLLOWER: 'new_follower'
};

// Notification channels
const NotificationChannel = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push'
};

// Notification schema
const notificationSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: Object.values(NotificationType),
    required: true
  },
  data: {
    type: Object,
    required: true
  },
  channels: [{
    type: String,
    enum: Object.values(NotificationChannel)
  }],
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Notification service
class NotificationService {
  async create(user, type, data, channels) {
    const notification = await Notification.create({
      user,
      type,
      data,
      channels
    });

    // Send to appropriate channels
    for (const channel of channels) {
      await this.send(notification, channel);
    }

    return notification;
  }

  async send(notification, channel) {
    switch (channel) {
      case NotificationChannel.IN_APP:
        await this.sendInApp(notification);
        break;
      case NotificationChannel.EMAIL:
        await this.sendEmail(notification);
        break;
      case NotificationChannel.PUSH:
        await this.sendPush(notification);
        break;
    }
  }

  async sendInApp(notification) {
    // Emit WebSocket event
    io.to(notification.user.toString()).emit('notification', notification);
  }

  async sendEmail(notification) {
    const template = await this.getEmailTemplate(notification.type);
    await emailService.send({
      to: notification.user.email,
      subject: template.subject,
      html: template.render(notification.data)
    });
  }

  async sendPush(notification) {
    const payload = this.getPushPayload(notification);
    await pushService.send(notification.user, payload);
  }
}
```

## Social Features

### User Profiles
```javascript
// Extended user schema
const userSchema = new Schema({
  // ... existing fields ...
  profile: {
    bio: String,
    website: String,
    location: String,
    avatar: String,
    socialLinks: {
      facebook: String,
      twitter: String,
      instagram: String
    }
  },
  following: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  followers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  savedRecipes: [{
    type: Schema.Types.ObjectId,
    ref: 'Recipe'
  }]
});
```

### Activity Feed
```javascript
// Activity schema
const activitySchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['create_recipe', 'rate_recipe', 'comment', 'follow', 'achievement'],
    required: true
  },
  data: {
    type: Object,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Activity service
class ActivityService {
  async createActivity(user, type, data) {
    const activity = await Activity.create({
      user,
      type,
      data
    });

    // Notify followers
    await this.notifyFollowers(user, activity);
    return activity;
  }

  async getActivityFeed(user, page = 1, limit = 10) {
    const following = await User.findById(user).select('following');
    return Activity.find({
      user: { $in: [...following, user] }
    })
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('user', 'name avatar');
  }
}
```

## Gamification

### Achievements System
```javascript
// Achievement schema
const achievementSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  icon: String,
  criteria: {
    type: {
      type: String,
      enum: ['recipes_created', 'ratings_received', 'followers_count', 'comments_received'],
      required: true
    },
    threshold: {
      type: Number,
      required: true
    }
  },
  points: {
    type: Number,
    default: 0
  }
});

// User achievements
const userAchievementSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  achievement: {
    type: Schema.Types.ObjectId,
    ref: 'Achievement',
    required: true
  },
  unlockedAt: {
    type: Date,
    default: Date.now
  }
});

// Achievement service
class AchievementService {
  async checkAchievements(user) {
    const achievements = await Achievement.find();
    const newAchievements = [];

    for (const achievement of achievements) {
      if (await this.qualifiesForAchievement(user, achievement)) {
        const userAchievement = await UserAchievement.create({
          user: user._id,
          achievement: achievement._id
        });
        newAchievements.push(userAchievement);

        // Notify user
        await notificationService.create(
          user._id,
          NotificationType.ACHIEVEMENT,
          { achievement },
          [NotificationChannel.IN_APP]
        );
      }
    }

    return newAchievements;
  }

  async getLeaderboard(page = 1, limit = 10) {
    return User.aggregate([
      {
        $lookup: {
          from: 'userachievements',
          localField: '_id',
          foreignField: 'user',
          as: 'achievements'
        }
      },
      {
        $addFields: {
          totalPoints: {
            $sum: '$achievements.points'
          }
        }
      },
      {
        $sort: { totalPoints: -1 }
      },
      {
        $skip: (page - 1) * limit
      },
      {
        $limit: limit
      }
    ]);
  }
}
```

## Internationalization

### Multi-language Support
```javascript
// i18n configuration
const i18n = require('i18n');

i18n.configure({
  locales: ['en', 'es', 'fr', 'de'],
  defaultLocale: 'en',
  directory: __dirname + '/locales',
  objectNotation: true,
  updateFiles: false,
  api: {
    __: 't',
    __n: 'tn'
  }
});

// Middleware to detect user locale
app.use((req, res, next) => {
  const locale = req.acceptsLanguages(i18n.getLocales()) || 'en';
  req.setLocale(locale);
  next();
});

// Localized recipe schema
const recipeSchema = new Schema({
  translations: [{
    locale: {
      type: String,
      enum: i18n.getLocales(),
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    instructions: [{
      step: Number,
      description: String
    }]
  }],
  // ... other fields ...
});

// Translation service
class TranslationService {
  async getRecipeInLocale(recipe, locale) {
    const translation = recipe.translations.find(t => t.locale === locale)
      || recipe.translations.find(t => t.locale === 'en');
    
    return {
      ...recipe.toObject(),
      title: translation.title,
      description: translation.description,
      instructions: translation.instructions
    };
  }
}
```

## Accessibility

### Accessibility Features
```javascript
// API response with accessibility metadata
const getRecipeResponse = (recipe) => ({
  ...recipe,
  metadata: {
    aria: {
      recipe: `Recipe: ${recipe.title}`,
      ingredients: 'List of ingredients',
      instructions: 'Step by step instructions',
      ratings: `Average rating: ${recipe.averageRating} out of 5`
    },
    role: 'article',
    lang: recipe.locale
  }
});

// Image metadata
const processImage = async (image) => {
  // Generate alt text using AI
  const altText = await imageAnalysisService.generateAltText(image);
  
  return {
    url: image.url,
    alt: altText,
    caption: image.caption,
    metadata: {
      aria: {
        img: altText
      }
    }
  };
};

// Structured data for screen readers
const generateStructuredData = (recipe) => ({
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: recipe.title,
  description: recipe.description,
  recipeIngredient: recipe.ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`),
  recipeInstructions: recipe.instructions.map(i => ({
    '@type': 'HowToStep',
    text: i.description
  }))
});
```

## Integration Examples

### Recipe Creation with Features
```javascript
// Create recipe with all features
const createRecipe = async (data, user) => {
  // Create recipe
  const recipe = await Recipe.create(data);

  // Index in Elasticsearch
  await searchService.indexRecipe(recipe);

  // Create activity
  await activityService.createActivity(user, 'create_recipe', { recipe });

  // Check achievements
  await achievementService.checkAchievements(user);

  // Notify followers
  const followers = await User.find({ following: user._id });
  for (const follower of followers) {
    await notificationService.create(
      follower._id,
      NotificationType.NEW_RECIPE,
      { recipe },
      [NotificationChannel.IN_APP, NotificationChannel.EMAIL]
    );
  }

  return recipe;
};
```

## Feature Flags
```javascript
// Feature flag configuration
const features = {
  search: {
    enabled: true,
    config: {
      engine: 'elasticsearch',
      fuzzyMatching: true,
      highlightResults: true
    }
  },
  notifications: {
    enabled: true,
    channels: ['in_app', 'email', 'push']
  },
  social: {
    enabled: true,
    features: ['profiles', 'following', 'activity']
  },
  gamification: {
    enabled: true,
    features: ['achievements', 'leaderboard']
  },
  i18n: {
    enabled: true,
    locales: ['en', 'es', 'fr', 'de']
  },
  accessibility: {
    enabled: true,
    features: ['aria', 'structuredData', 'imageAlt']
  }
};
``` 