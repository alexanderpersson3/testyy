import { ObjectId } from 'mongodb';
import { storeFixtures } from './stores.fixture';

export const storeProductFixtures = {
  freshProduce: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4588'),
    storeId: storeFixtures.localStore._id,
    name: 'Organic Bananas',
    description: 'Fresh organic bananas from Ecuador',
    category: 'Produce',
    brand: 'Nature\'s Best',
    price: {
      amount: 2.99,
      currency: 'USD'
    },
    unit: 'lb',
    inStock: true,
    nutritionInfo: {
      calories: 105,
      protein: 1.3,
      carbohydrates: 27,
      fat: 0.3,
      fiber: 3.1
    },
    allergens: [],
    barcode: '0123456789',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  },
  dairyProduct: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4589'),
    storeId: storeFixtures.supermarket._id,
    name: 'Whole Milk',
    description: 'Fresh whole milk from local farms',
    category: 'Dairy',
    brand: 'Farm Fresh',
    price: {
      amount: 3.99,
      currency: 'USD'
    },
    unit: 'gallon',
    inStock: true,
    nutritionInfo: {
      calories: 150,
      protein: 8,
      carbohydrates: 12,
      fat: 8,
      calcium: 300
    },
    allergens: ['milk'],
    barcode: '9876543210',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  },
  bakeryProduct: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4590'),
    storeId: storeFixtures.supermarket._id,
    name: 'Whole Grain Bread',
    description: 'Freshly baked whole grain bread',
    category: 'Bakery',
    brand: 'Artisan Bakers',
    price: {
      amount: 4.99,
      currency: 'USD'
    },
    unit: 'loaf',
    inStock: true,
    nutritionInfo: {
      calories: 80,
      protein: 4,
      carbohydrates: 15,
      fat: 1,
      fiber: 2
    },
    allergens: ['wheat', 'gluten'],
    barcode: '5432109876',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  }
}; 