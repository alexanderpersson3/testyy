# Rezepta Type System Documentation

## Overview
The Rezepta type system is designed to provide type safety and consistency across the application. It's organized into several key domains:

- Recipe Management (`recipe.ts`)
- Store & Pricing (`store.ts`)
- Social Features (`social.ts`)
- Notifications (`notification.ts`)
- Achievements & Gamification (`achievement.ts`)
- Subscriptions & Premium Features (`subscription.ts`)

## Common Patterns

### Document Pattern
All main entities follow the MongoDB document pattern:
```typescript
// Base interface for the entity
interface Entity {
  _id?: ObjectId;  // Optional for new entities
  // ... other fields
}

// Document interface for retrieved entities
interface EntityDocument extends Entity {
  _id: ObjectId;   // Required for existing entities
}
```

### Query Options Pattern
Search and list operations use consistent query options:
```typescript
interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

## Social Features Examples

### Following Users
```typescript
import { UserFollow, ActivityType } from '../types/social';

// Create a new follow relationship
const follow: UserFollow = {
  followerId: currentUserId,
  followingId: targetUserId,
  createdAt: new Date()
};

// Create activity feed item for the follow
const activity: ActivityFeedItem = {
  userId: currentUserId,
  activityType: 'user_followed',
  targetId: targetUserId,
  metadata: {
    userName: targetUserName
  },
  createdAt: new Date()
};
```

### Querying Activity Feed
```typescript
import { FeedQueryOptions } from '../types/social';

// Get recent activities for a user
const feedOptions: FeedQueryOptions = {
  userId: currentUserId,
  activityTypes: ['recipe_created', 'recipe_liked'],
  limit: 20,
  offset: 0
};
```

## Notification System Examples

### Setting Up User Preferences
```typescript
import { NotificationPreferences } from '../types/notification';

const preferences: NotificationPreferences = {
  userId: currentUserId,
  channels: {
    recipe_created: ['push', 'email'],
    recipe_liked: ['push'],
    user_followed: ['push', 'in_app']
  },
  pushEnabled: true,
  emailEnabled: true,
  pushTokens: [{
    token: 'device-token',
    platform: 'ios',
    lastUsed: new Date()
  }],
  quietHours: {
    start: '22:00',
    end: '08:00',
    timezone: 'Europe/Stockholm'
  },
  updatedAt: new Date()
};
```

### Sending Notifications
```typescript
import { Notification, NotificationPriority } from '../types/notification';

const notification: Notification = {
  userId: targetUserId,
  title: 'New Recipe Alert!',
  body: 'Check out this new vegan pasta recipe',
  activityType: 'recipe_created',
  channels: ['push', 'in_app'],
  priority: 'high',
  status: 'pending',
  metadata: {
    recipeId: newRecipeId,
    deepLink: 'rezepta://recipes/${recipeId}'
  },
  createdAt: new Date()
};
```

## Achievement System Examples

### Creating a Challenge
```typescript
import { Challenge, ChallengeType } from '../types/achievement';

const challenge: Challenge = {
  title: 'Vegan Week',
  description: 'Cook 5 vegan recipes in 7 days',
  type: 'recipe_count',
  requirements: {
    count: 5,
    dietTypes: ['vegan'],
    duration: 7
  },
  rewards: {
    points: 500,
    badgeId: veganBadgeId
  },
  startDate: new Date(),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  isRecurring: false,
  createdAt: new Date(),
  updatedAt: new Date()
};
```

### Tracking User Progress
```typescript
import { UserChallenge, UserAchievementStats } from '../types/achievement';

// Update user's challenge progress
const userChallenge: UserChallenge = {
  userId: currentUserId,
  challengeId: challengeId,
  status: 'active',
  progress: 3,
  currentStreak: 3,
  bestStreak: 5,
  lastUpdated: new Date(),
  history: [{
    date: new Date(),
    progressDelta: 1,
    details: 'Completed vegan pasta recipe'
  }]
};

// Update achievement stats
const stats: UserAchievementStats = {
  userId: currentUserId,
  totalPoints: 1500,
  badgeCount: {
    total: 10,
    bronze: 5,
    silver: 3,
    gold: 2,
    platinum: 0
  },
  completedChallenges: 8,
  currentStreaks: {
    daily: 3,
    weekly: 2
  },
  bestStreaks: {
    daily: 7,
    weekly: 4
  },
  lastUpdated: new Date()
};
```

## Subscription System Examples

### Managing Subscriptions
```typescript
import { UserSubscription, SubscriptionTier } from '../types/subscription';

// Create new subscription
const subscription: UserSubscription = {
  userId: currentUserId,
  planId: premiumPlanId,
  status: 'active',
  tier: 'premium',
  billingInterval: 'monthly',
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  provider: 'stripe',
  providerSubscriptionId: 'sub_123',
  providerCustomerId: 'cus_123',
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  metadata: {
    promotionCode: 'WELCOME2024'
  },
  createdAt: new Date(),
  updatedAt: new Date()
};
```

### Feature Access Control
```typescript
import { SubscriptionFeatureAccess } from '../types/subscription';

// Check feature access based on subscription
const featureAccess: SubscriptionFeatureAccess = {
  offlineAccess: true,
  advancedFilters: true,
  mealPlanning: true,
  nutritionTracking: true,
  adFree: true,
  customCollections: true,
  prioritySupport: false,
  exclusiveContent: false,
  maxRecipeStorage: 1000,
  maxCollections: 50,
  maxShoppingLists: 10
};
```

## Best Practices

1. **Type Guards**: Use type guards to ensure type safety:
```typescript
function isSubscriptionDocument(sub: UserSubscription | UserSubscriptionDocument): sub is UserSubscriptionDocument {
  return '_id' in sub;
}
```

2. **Readonly Types**: For immutable data, use readonly types:
```typescript
type ReadonlySubscriptionFeatureAccess = Readonly<SubscriptionFeatureAccess>;
```

3. **Union Types**: Use union types for status fields:
```typescript
type Status = NotificationStatus | SubscriptionStatus | ChallengeStatus;
```

4. **Partial Updates**: Use Partial<T> for update operations:
```typescript
function updateNotificationPreferences(userId: ObjectId, update: Partial<NotificationPreferences>) {
  // Update logic
}
```

## Integration Examples

### Recipe Creation with Social Features
```typescript
async function createRecipeWithSocial(recipe: RecipeInput) {
  // Create recipe
  const newRecipe = await recipeService.create(recipe);
  
  // Create activity
  const activity: ActivityFeedItem = {
    userId: recipe.userId,
    activityType: 'recipe_created',
    targetId: newRecipe._id,
    metadata: {
      recipeTitle: recipe.name
    },
    createdAt: new Date()
  };
  
  // Send notifications to followers
  const notification: NotificationBatch = {
    title: 'New Recipe',
    body: `${userName} shared a new recipe: ${recipe.name}`,
    activityType: 'recipe_created',
    channels: ['push', 'in_app'],
    priority: 'medium',
    filters: {
      userIds: followerIds
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  return { recipe: newRecipe, activity, notification };
} 