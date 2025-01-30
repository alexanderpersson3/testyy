# Social Features API Documentation

## Profile Management

### Get User Profile
```http
GET /api/social/profiles/:userId
```
Returns a user's profile information including stats, highlights, and customization settings.

**Response Example:**
```json
{
  "profile": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "displayName": "John Doe",
    "bio": "Food enthusiast and home chef",
    "avatar": "https://example.com/avatar.jpg",
    "socialLinks": {
      "instagram": "https://instagram.com/johndoe",
      "facebook": "https://facebook.com/johndoe",
      "website": "https://johndoe.com"
    },
    "stats": {
      "followers": 150,
      "following": 89,
      "recipes": 45,
      "likes": 1250
    },
    "isPro": true,
    "isVerified": true
  }
}
```

### Update Profile
```http
PATCH /api/social/profiles/me
```
Update your profile information.

**Request Body:**
```json
{
  "displayName": "John Doe",
  "bio": "Food enthusiast and home chef",
  "socialLinks": {
    "instagram": "https://instagram.com/johndoe",
    "facebook": "https://facebook.com/johndoe",
    "website": "https://johndoe.com"
  }
}
```

## Story Management

### Create Story
```http
POST /api/social/stories
```
Create a new story.

**Request Body:**
```json
{
  "type": "image",
  "content": "Check out my latest recipe!",
  "mediaUrl": "https://example.com/image.jpg",
  "expiresAt": "2024-03-20T15:00:00Z"
}
```

### Get User Stories
```http
GET /api/social/stories/:userId
```
Get all active stories for a user.

### View Story
```http
POST /api/social/stories/:storyId/view
```
Mark a story as viewed.

## Story Interactions

### Add Comment
```http
POST /api/social/stories/:storyId/comments
```
Add a comment to a story.

**Request Body:**
```json
{
  "content": "This looks amazing! 😍"
}
```

### Get Comments
```http
GET /api/social/stories/:storyId/comments?page=1&limit=20
```
Get paginated comments for a story.

### Add Reaction
```http
POST /api/social/stories/:storyId/reactions
```
Add a reaction to a story.

**Request Body:**
```json
{
  "type": "❤️"
}
```
Available reactions: ❤️, 👍, 😂, 😮, 😢, 😡

### Share Story
```http
POST /api/social/stories/:storyId/share
```
Share a story with optional recipient and message.

**Request Body:**
```json
{
  "sharedToId": "507f1f77bcf86cd799439013",
  "message": "You have to try this recipe!"
}
```

## Follow System

### Follow User
```http
POST /api/social/follow/:userId
```
Follow another user.

### Unfollow User
```http
DELETE /api/social/follow/:userId
```
Unfollow a user.

### Get Followers
```http
GET /api/social/followers/:userId?page=1&limit=20
```
Get paginated list of user's followers.

### Get Following
```http
GET /api/social/following/:userId?page=1&limit=20
```
Get paginated list of users being followed.

## Content Discovery

### Explore Feed
```http
GET /api/social/explore?page=1&limit=20
```
Get personalized explore feed with mixed content types.

### Popular Users
```http
GET /api/social/popular?limit=10
```
Get list of popular users based on follower count.

## User Safety

### Block User
```http
POST /api/social/block/:userId
```
Block a user with optional reason.

**Request Body:**
```json
{
  "reason": "Inappropriate content"
}
```

### Report Content
```http
POST /api/social/report
```
Report inappropriate content.

**Request Body:**
```json
{
  "contentType": "story",
  "contentId": "507f1f77bcf86cd799439014",
  "reason": "inappropriate",
  "description": "This content contains misleading information"
}
```

## Profile Customization

### Update Customization
```http
PATCH /api/social/profiles/me/customization
```
Update profile customization settings.

**Request Body:**
```json
{
  "theme": "dark",
  "accentColor": "#FF5733",
  "layout": "grid",
  "showStats": true,
  "privacySettings": {
    "profileVisibility": "public",
    "storyComments": "followers",
    "allowSharing": true,
    "showActivity": true
  }
}
```

## Error Responses

All endpoints may return the following error responses:

- `400 Bad Request`: Invalid input parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Example error response:
```json
{
  "errors": [
    {
      "msg": "Invalid value",
      "param": "displayName",
      "location": "body"
    }
  ]
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse. Current limits:
- 100 requests per minute for authenticated endpoints
- 30 requests per minute for public endpoints

## Authentication

Most endpoints require authentication using a Bearer token:
```http
Authorization: Bearer <your_jwt_token>
```

## Pagination

Endpoints that return lists support pagination using `page` and `limit` query parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 50)

Example paginated response:
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "limit": 20
}
``` 