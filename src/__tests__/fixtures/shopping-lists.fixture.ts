import { ObjectId } from 'mongodb';
import { userFixtures } from './users.fixture';
import { recipeFixtures } from './recipes.fixture';

export const shoppingListFixtures = {
  defaultList: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4575'),
    userId: userFixtures.regularUser._id,
    name: 'Default Shopping List',
    items: [
      {
        _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4576'),
        ingredientId: recipeFixtures.basicRecipe.ingredients[0]._id,
        name: 'Pasta',
        quantity: 500,
        unit: 'g',
        checked: false,
        addedAt: new Date('2023-01-01')
      },
      {
        _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4577'),
        ingredientId: recipeFixtures.basicRecipe.ingredients[1]._id,
        name: 'Tomato Sauce',
        quantity: 400,
        unit: 'ml',
        checked: true,
        addedAt: new Date('2023-01-01')
      }
    ],
    isDefault: true,
    status: 'active',
    lastModified: new Date('2023-01-01'),
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  },
  sharedList: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4578'),
    userId: userFixtures.regularUser._id,
    name: 'Shared Shopping List',
    items: [
      {
        _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4579'),
        ingredientId: recipeFixtures.premiumRecipe.ingredients[0]._id,
        name: 'Arborio Rice',
        quantity: 300,
        unit: 'g',
        checked: false,
        addedAt: new Date('2023-01-01')
      }
    ],
    isDefault: false,
    status: 'active',
    sharedWith: [userFixtures.premiumUser._id],
    lastModified: new Date('2023-01-01'),
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  }
}; 