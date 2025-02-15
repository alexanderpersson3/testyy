# Collection API Documentation

## Sort Collection Recipes

Sort recipes within a collection based on various criteria.

**URL**: `/api/collections/:collectionId/sort`

**Method**: `POST`

**Auth required**: Yes

**Request Body**:
```json
{
  "field": "name | rating | difficulty | cookingTime | created | updated | popularity",
  "direction": "asc | desc"
}
```

**Success Response**:
- **Code**: 200
- **Content**:
```json
{
  "success": true
}
```

**Error Response**:
- **Code**: 400
- **Content**:
```json
{
  "errors": [
    {
      "msg": "Invalid sort field",
      "param": "field",
      "location": "body"
    }
  ]
}
```

## Filter Collection Recipes

Filter recipes within a collection based on various criteria.

**URL**: `/api/collections/:collectionId/filter`

**Method**: `POST`

**Auth required**: Yes

**Request Body**:
```json
{
  "tags": ["string"],
  "rating": {
    "min": 0,
    "max": 5
  },
  "difficulty": ["easy", "medium", "hard"],
  "cookingTime": {
    "min": 0,
    "max": 180
  },
  "ingredients": {
    "include": ["string"],
    "exclude": ["string"]
  },
  "cuisine": ["string"],
  "dietary": ["string"],
  "searchText": "string"
}
```

All fields are optional. Only specified filters will be applied.

**Success Response**:
- **Code**: 200
- **Content**:
```json
{
  "_id": "string",
  "userId": "string",
  "name": "string",
  "description": "string",
  "visibility": "private | shared | public",
  "thumbnail": "string",
  "tags": ["string"],
  "recipes": [
    {
      "recipeId": "string",
      "position": 0,
      "notes": "string",
      "tags": ["string"],
      "rating": 0,
      "lastCooked": "2024-01-01T00:00:00.000Z",
      "timesCooked": 0,
      "isFavorite": false,
      "addedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "collaborators": [
    {
      "userId": "string",
      "role": "viewer | editor | admin",
      "addedAt": "2024-01-01T00:00:00.000Z",
      "addedBy": "string",
      "lastAccessed": "2024-01-01T00:00:00.000Z"
    }
  ],
  "stats": {
    "recipeCount": 0,
    "totalCookTime": 0,
    "averageRating": 0,
    "viewCount": 0,
    "saveCount": 0,
    "shareCount": 0,
    "lastCookedAt": "2024-01-01T00:00:00.000Z",
    "popularTags": [
      {
        "tag": "string",
        "count": 0
      }
    ]
  },
  "settings": {
    "sortBy": "name | created | updated | popularity | custom",
    "sortDirection": "asc | desc",
    "defaultView": "grid | list | detailed",
    "showNotes": true,
    "showRatings": true,
    "showCookingHistory": true,
    "enableNotifications": true,
    "autoAddToGroceryList": false
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Response**:
- **Code**: 400
- **Content**:
```json
{
  "errors": [
    {
      "msg": "Rating must be between 0 and 5",
      "param": "rating.min",
      "location": "body"
    }
  ]
}
```

## Error Codes

- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing or invalid authentication)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (collection not found)
- `500` - Internal Server Error

## Rate Limiting

All endpoints are subject to rate limiting:
- 100 requests per minute per IP address
- 1000 requests per hour per user

## Examples

### Sort Recipes by Rating

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "field": "rating",
    "direction": "desc"
  }' \
  https://api.example.com/collections/123/sort
```

### Filter Vegetarian Recipes

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dietary": ["vegetarian"],
    "cookingTime": {
      "max": 30
    }
  }' \
  https://api.example.com/collections/123/filter
```

## Notes

- All timestamps are in ISO 8601 format
- All IDs are MongoDB ObjectIds
- The `searchText` parameter performs a full-text search across recipe titles, descriptions, ingredients, and instructions
- Filters are combined with AND logic
- Array filters (tags, dietary, etc.) use AND logic within the array 