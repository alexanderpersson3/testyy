# Rezepta API Endpoints Documentation

## Authentication

All endpoints except those marked with `[Public]` require authentication via Bearer token.

## Common Response Types

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

## Recipe Endpoints

### [Public] Search Recipes
```typescript
// GET /api/recipes/search
interface SearchRequest {
  query: string;
  filters?: RecipeSearchFilters;
  options?: RecipeSearchOptions;
}

type SearchResponse = PaginatedResponse<Recipe>;

// Example usage with zod validation
const searchSchema = z.object({
  query: z.string().min(1),
  filters: recipeSearchFiltersSchema.optional(),
  options: recipeSearchOptionsSchema.optional()
});

router.get('/search', async (req: AuthenticatedRequest, res: Response) => {
  const validated = searchSchema.parse(req.query);
  const results = await recipeService.search(validated);
  res.json({ success: true, data: results });
});
```

### Create Recipe
```typescript
// POST /api/recipes
interface CreateRecipeRequest {
  recipe: RecipeInput;
  media?: {
    imageUrls: string[];
    primaryImageIndex?: number;
  };
}

interface CreateRecipeResponse {
  recipe: RecipeDocument;
  media: RecipeMedia[];
  activity: ActivityFeedItem;
}

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { recipe, media } = createRecipeSchema.parse(req.body);
  const result = await recipeService.createWithSocial(recipe, media, req.user);
  res.status(201).json({ success: true, data: result });
});
```

## Social Endpoints

### Follow User
```typescript
// POST /api/social/follow/{userId}
interface FollowResponse {
  follow: UserFollowDocument;
  activity: ActivityFeedItem;
  notification: NotificationDocument;
}

router.post('/follow/:userId', async (req: AuthenticatedRequest, res: Response) => {
  const targetUserId = new ObjectId(req.params.userId);
  const result = await socialService.followUser(req.user._id, targetUserId);
  res.status(201).json({ success: true, data: result });
});
```

### Get Activity Feed
```typescript
// GET /api/social/feed
interface GetFeedRequest {
  activityTypes?: ActivityType[];
  startDate?: string; // ISO date string
  endDate?: string;   // ISO date string
  limit?: number;
  offset?: number;
}

type GetFeedResponse = PaginatedResponse<ActivityFeedItem>;

router.get('/feed', async (req: AuthenticatedRequest, res: Response) => {
  const options = feedQuerySchema.parse(req.query);
  const feed = await socialService.getFeed(req.user._id, options);
  res.json({ success: true, data: feed });
});
```

## Achievement Endpoints

### Get Active Challenges
```typescript
// GET /api/challenges/active
interface GetChallengesResponse {
  active: Array<{
    challenge: ChallengeDocument;
    progress: UserChallenge;
  }>;
  completed: Array<{
    challenge: ChallengeDocument;
    progress: UserChallenge;
  }>;
  upcoming: ChallengeDocument[];
}

router.get('/active', async (req: AuthenticatedRequest, res: Response) => {
  const challenges = await challengeService.getActiveForUser(req.user._id);
  res.json({ success: true, data: challenges });
});
```

### Track Achievement Progress
```typescript
// POST /api/achievements/track
interface TrackProgressRequest {
  type: string;
  metadata: {
    recipeId?: string;
    cuisineType?: string;
    dietType?: string;
    count?: number;
  };
}

interface TrackProgressResponse {
  achievement: AchievementDocument;
  unlockedBadges: BadgeDocument[];
  updatedStats: UserAchievementStats;
  notifications: NotificationDocument[];
}

router.post('/track', async (req: AuthenticatedRequest, res: Response) => {
  const data = trackProgressSchema.parse(req.body);
  const result = await achievementService.trackProgress(req.user._id, data);
  res.status(201).json({ success: true, data: result });
});
```

## Subscription Endpoints

### Create Subscription
```typescript
// POST /api/subscriptions
interface CreateSubscriptionRequest {
  planId: string;
  billingInterval: BillingInterval;
  paymentMethodId: string;
  promotionCode?: string;
}

interface CreateSubscriptionResponse {
  subscription: UserSubscriptionDocument;
  invoice: SubscriptionInvoiceDocument;
  featureAccess: SubscriptionFeatureAccess;
}

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const data = createSubscriptionSchema.parse(req.body);
  const result = await subscriptionService.create(req.user._id, data);
  res.status(201).json({ success: true, data: result });
});
```

### Check Feature Access
```typescript
// GET /api/subscriptions/features
interface FeatureAccessResponse {
  features: SubscriptionFeatureAccess;
  subscription: UserSubscriptionDocument;
}

router.get('/features', async (req: AuthenticatedRequest, res: Response) => {
  const access = await subscriptionService.getFeatureAccess(req.user._id);
  res.json({ success: true, data: access });
});
```

## Notification Endpoints

### Update Preferences
```typescript
// PUT /api/notifications/preferences
interface UpdatePreferencesRequest {
  channels?: {
    [key in ActivityType]?: NotificationChannel[];
  };
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  quietHours?: {
    start: string;
    end: string;
    timezone: string;
  };
}

router.put('/preferences', async (req: AuthenticatedRequest, res: Response) => {
  const prefs = updatePreferencesSchema.parse(req.body);
  const updated = await notificationService.updatePreferences(req.user._id, prefs);
  res.json({ success: true, data: updated });
});
```

### Get Notifications
```typescript
// GET /api/notifications
interface GetNotificationsRequest {
  status?: NotificationStatus[];
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

type GetNotificationsResponse = PaginatedResponse<NotificationDocument>;

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const options = getNotificationsSchema.parse(req.query);
  const notifications = await notificationService.getForUser(req.user._id, options);
  res.json({ success: true, data: notifications });
});
```

## Error Handling

All endpoints use a consistent error handling pattern:

```typescript
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors
      }
    });
  }

  if (err instanceof AuthError) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: err.message
      }
    });
  }

  // ... handle other error types

  console.error(err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
}); 