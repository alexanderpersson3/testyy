# Social Features Example Usage Scenarios

## 1. User Profile and Customization

### Scenario: Setting up a Chef Profile
```typescript
// 1. Update profile information
await axios.patch('/api/social/profiles/me', {
  displayName: "Chef Maria",
  bio: "Passionate about Mediterranean cuisine",
  socialLinks: {
    instagram: "https://instagram.com/chefmaria",
    website: "https://mariascooking.com"
  }
});

// 2. Add profile highlights
await axios.post('/api/social/profiles/me/highlights', {
  title: "Signature Paella",
  description: "My award-winning seafood paella",
  mediaUrl: "https://example.com/paella.jpg",
  mediaType: "image"
});

// 3. Customize profile appearance
await axios.patch('/api/social/profiles/me/customization', {
  theme: "dark",
  accentColor: "#FF5733",
  layout: "grid",
  privacySettings: {
    profileVisibility: "public",
    storyComments: "followers",
    allowSharing: true
  }
});
```

## 2. Story Creation and Interaction

### Scenario: Sharing a Recipe Story
```typescript
// 1. Create a new story
const storyResponse = await axios.post('/api/social/stories', {
  type: "image",
  content: "Just perfected my sourdough recipe! 🍞",
  mediaUrl: "https://example.com/sourdough.jpg",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
});

// 2. Users interact with the story
const storyId = storyResponse.data.storyId;

// Add comments
await axios.post(`/api/social/stories/${storyId}/comments`, {
  content: "Looks amazing! Can you share the recipe?"
});

// Add reactions
await axios.post(`/api/social/stories/${storyId}/reactions`, {
  type: "❤️"
});

// Share with a friend
await axios.post(`/api/social/stories/${storyId}/share`, {
  sharedToId: "friend_user_id",
  message: "You need to try making this!"
});
```

## 3. Building a Following

### Scenario: Growing Your Cooking Network
```typescript
// 1. Follow other chefs
await axios.post('/api/social/follow/chef_id');

// 2. Check your followers
const followers = await axios.get('/api/social/followers/my_id', {
  params: { page: 1, limit: 20 }
});

// 3. View popular users to follow
const popularUsers = await axios.get('/api/social/popular', {
  params: { limit: 10 }
});
```

## 4. Content Discovery

### Scenario: Exploring New Content
```typescript
// 1. Get personalized explore feed
const exploreFeed = await axios.get('/api/social/explore', {
  params: { page: 1, limit: 20 }
});

// 2. View user stories
const userStories = await axios.get(`/api/social/stories/${userId}`);

// 3. Mark stories as viewed
await axios.post(`/api/social/stories/${storyId}/view`);
```

## 5. Community Safety

### Scenario: Handling Inappropriate Content
```typescript
// 1. Block a problematic user
await axios.post(`/api/social/block/${userId}`, {
  reason: "Spam content"
});

// 2. Report inappropriate content
await axios.post('/api/social/report', {
  contentType: "story",
  contentId: "story_id",
  reason: "inappropriate",
  description: "Contains misleading health information"
});

// 3. View blocked users
const blockedUsers = await axios.get('/api/social/blocked');
```

## 6. Advanced Features

### Scenario: Creating an Interactive Cooking Session
```typescript
// 1. Create a live cooking story
const storyResponse = await axios.post('/api/social/stories', {
  type: "video",
  content: "Live Pasta Making Workshop 🍝",
  mediaUrl: "https://streaming-url.com/live",
  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
});

// 2. Enable real-time interactions
const storyId = storyResponse.data.storyId;

// Monitor comments in real-time
const commentStream = new EventSource(`/api/social/stories/${storyId}/comments/stream`);
commentStream.onmessage = (event) => {
  const comment = JSON.parse(event.data);
  // Handle new comment
};

// Track reactions in real-time
const reactionStream = new EventSource(`/api/social/stories/${storyId}/reactions/stream`);
reactionStream.onmessage = (event) => {
  const reactions = JSON.parse(event.data);
  // Update reaction counts
};
```

## 7. Integration Examples

### Example: Profile Widget
```typescript
class ProfileWidget {
  async render(userId: string) {
    // Get user profile
    const profile = await axios.get(`/api/social/profiles/${userId}`);
    
    // Get recent stories
    const stories = await axios.get(`/api/social/stories/${userId}`);
    
    // Get follower count
    const followers = await axios.get(`/api/social/followers/${userId}`);
    
    return `
      <div class="profile-widget">
        <img src="${profile.data.avatar}" alt="${profile.data.displayName}" />
        <h2>${profile.data.displayName}</h2>
        <p>${profile.data.bio}</p>
        <div class="stats">
          <span>${followers.data.total} followers</span>
          <span>${stories.data.stories.length} stories</span>
        </div>
      </div>
    `;
  }
}
```

### Example: Story Feed Component
```typescript
class StoryFeed {
  async loadStories() {
    const response = await axios.get('/api/social/explore');
    return response.data.content.map(story => `
      <div class="story-card">
        <img src="${story.mediaUrl}" alt="${story.content}" />
        <p>${story.content}</p>
        <div class="interactions">
          <button onclick="this.react('${story._id}', '❤️')">❤️</button>
          <button onclick="this.comment('${story._id}')">💬</button>
          <button onclick="this.share('${story._id}')">↗️</button>
        </div>
      </div>
    `).join('');
  }

  async react(storyId: string, type: string) {
    await axios.post(`/api/social/stories/${storyId}/reactions`, { type });
  }

  async comment(storyId: string) {
    const content = prompt('Enter your comment:');
    if (content) {
      await axios.post(`/api/social/stories/${storyId}/comments`, { content });
    }
  }

  async share(storyId: string) {
    const message = prompt('Add a message (optional):');
    await axios.post(`/api/social/stories/${storyId}/share`, { message });
  }
}
```

These examples demonstrate common usage patterns and integrations for the social features. They can be used as a starting point for implementing the frontend components and user interactions. 