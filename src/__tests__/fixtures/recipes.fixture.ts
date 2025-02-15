import { ObjectId } from 'mongodb';
import { userFixtures } from './users.fixture';

export const recipeFixtures = {
  basicRecipe: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4570'),
    userId: userFixtures.regularUser._id,
    title: 'Simple Pasta',
    description: 'A basic pasta recipe',
    ingredients: [
      {
        _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4571'),
        name: 'Pasta',
        quantity: 500,
        unit: 'g',
        notes: 'Any type of pasta'
      },
      {
        _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4572'),
        name: 'Tomato Sauce',
        quantity: 400,
        unit: 'ml',
        notes: 'Homemade or store-bought'
      }
    ],
    instructions: [
      'Boil water in a large pot',
      'Add salt to the water',
      'Cook pasta according to package instructions',
      'Heat tomato sauce in a pan',
      'Combine pasta and sauce'
    ],
    prepTime: 10,
    cookTime: 20,
    servings: 4,
    difficulty: 'EASY',
    cuisine: 'ITALIAN',
    tags: ['pasta', 'quick', 'easy'],
    isPublished: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    stats: {
      rating: 4.5,
      ratingCount: 10,
      favoriteCount: 5,
      viewCount: 100
    }
  },
  premiumRecipe: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4573'),
    userId: userFixtures.premiumUser._id,
    title: 'Gourmet Risotto',
    description: 'A premium risotto recipe',
    ingredients: [
      {
        _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4574'),
        name: 'Arborio Rice',
        quantity: 300,
        unit: 'g',
        notes: 'Italian short-grain rice'
      }
    ],
    instructions: [
      'Toast rice in pan',
      'Add wine and let it evaporate',
      'Gradually add hot broth'
    ],
    prepTime: 15,
    cookTime: 30,
    servings: 4,
    difficulty: 'INTERMEDIATE',
    cuisine: 'ITALIAN',
    tags: ['risotto', 'gourmet', 'premium'],
    isPublished: true,
    isPremium: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    stats: {
      rating: 4.8,
      ratingCount: 20,
      favoriteCount: 15,
      viewCount: 200
    }
  }
}; 