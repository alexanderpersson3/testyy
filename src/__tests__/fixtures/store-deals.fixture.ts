import { ObjectId } from 'mongodb';
import { storeFixtures } from './stores.fixture';

export const storeDealFixtures = {
  weeklyDeal: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4582'),
    storeId: storeFixtures.localStore._id,
    title: 'Weekly Special Deals',
    description: 'Great savings on fresh produce',
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-01-07'),
    items: [
      {
        productId: new ObjectId('5f7d3a2e9d5c1b1b1c9b4583'),
        name: 'Fresh Apples',
        originalPrice: 2.99,
        discountedPrice: 1.99,
        discountPercentage: 33
      },
      {
        productId: new ObjectId('5f7d3a2e9d5c1b1b1c9b4584'),
        name: 'Organic Carrots',
        originalPrice: 3.49,
        discountedPrice: 2.49,
        discountPercentage: 29
      }
    ],
    conditions: [
      'While supplies last',
      'Limited to 5 items per customer'
    ],
    isActive: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  },
  holidayDeal: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4585'),
    storeId: storeFixtures.supermarket._id,
    title: 'Holiday Special',
    description: 'Festive season savings',
    startDate: new Date('2023-12-20'),
    endDate: new Date('2023-12-31'),
    items: [
      {
        productId: new ObjectId('5f7d3a2e9d5c1b1b1c9b4586'),
        name: 'Holiday Turkey',
        originalPrice: 45.99,
        discountedPrice: 35.99,
        discountPercentage: 22
      },
      {
        productId: new ObjectId('5f7d3a2e9d5c1b1b1c9b4587'),
        name: 'Christmas Cookies',
        originalPrice: 8.99,
        discountedPrice: 5.99,
        discountPercentage: 33
      }
    ],
    conditions: [
      'Members only',
      'One per household'
    ],
    isActive: true,
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date('2023-12-01')
  }
}; 