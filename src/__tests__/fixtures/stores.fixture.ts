import { ObjectId } from 'mongodb';

export const storeFixtures = {
  localStore: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4580'),
    name: 'Local Grocery Store',
    location: {
      address: '123 Main St',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
      postalCode: '12345',
      coordinates: {
        latitude: 40.7128,
        longitude: -74.0060
      }
    },
    operatingHours: {
      monday: { open: '08:00', close: '20:00' },
      tuesday: { open: '08:00', close: '20:00' },
      wednesday: { open: '08:00', close: '20:00' },
      thursday: { open: '08:00', close: '20:00' },
      friday: { open: '08:00', close: '20:00' },
      saturday: { open: '09:00', close: '18:00' },
      sunday: { open: '10:00', close: '16:00' }
    },
    contact: {
      phone: '+1-555-123-4567',
      email: 'local@example.com',
      website: 'https://local.example.com'
    },
    ratings: {
      average: 4.5,
      count: 100
    },
    features: ['parking', 'delivery', 'organic'],
    isActive: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  },
  supermarket: {
    _id: new ObjectId('5f7d3a2e9d5c1b1b1c9b4581'),
    name: 'Super Market',
    location: {
      address: '456 High St',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
      postalCode: '12345',
      coordinates: {
        latitude: 40.7129,
        longitude: -74.0061
      }
    },
    operatingHours: {
      monday: { open: '07:00', close: '22:00' },
      tuesday: { open: '07:00', close: '22:00' },
      wednesday: { open: '07:00', close: '22:00' },
      thursday: { open: '07:00', close: '22:00' },
      friday: { open: '07:00', close: '22:00' },
      saturday: { open: '08:00', close: '22:00' },
      sunday: { open: '08:00', close: '20:00' }
    },
    contact: {
      phone: '+1-555-987-6543',
      email: 'super@example.com',
      website: 'https://super.example.com'
    },
    ratings: {
      average: 4.2,
      count: 500
    },
    features: ['parking', 'delivery', 'pharmacy', 'bakery', '24h-atm'],
    isActive: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  }
}; 