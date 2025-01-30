import { expect } from 'chai';
import { ObjectId } from 'mongodb';
import { createTestIngredient, createTestProduct } from '@helpers/test-utils';
import { setupMockDb, closeMockDb, getMockDb, clearMockDb } from '../mock-db.js';
import * as ingredientService from '../../services/ingredient-service.js';

describe('IngredientService', () => {
  let db;

  beforeAll(async () => {
    db = await setupMockDb();
    ingredientService.setTestDb(db);
  });

  beforeEach(async () => {
    // Completely reset the database state
    await db.dropDatabase();
    // Setup fresh collection with test data
    await db.createCollection('normalized_ingredients');
    await db.collection('normalized_ingredients').createIndex(
      { name: 'text', normalized_name: 'text' },
      { default_language: 'none' }
    );

    // Seed base test data with initial products
    await db.collection('normalized_ingredients').insertMany([
      { 
        name: 'milk',
        normalized_name: 'milk',
        category: 'dairy',
        products: [{ name: 'Test Milk 1L', price: 10, store: 'ICA' }]
      },
      { 
        name: 'pasta',
        normalized_name: 'pasta',
        category: 'pantry',
        products: []
      },
      { 
        name: 'beef',
        normalized_name: 'beef',
        category: 'meat',
        products: []
      }
    ]);
    
    // Clear any test-specific mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await closeMockDb();
  });

  describe('normalizeIngredientName', () => {
    it('should normalize "ICA Mjölk 3% 1L" to "mjölk"', () => {
      expect(ingredientService.normalizeIngredientName('ICA Mjölk 3% 1L')).to.equal('mjölk');
    });

    it('should normalize "Garant Pasta (500g)" to "pasta"', () => {
      expect(ingredientService.normalizeIngredientName('Garant Pasta (500g)')).to.equal('pasta');
    });

    it('should normalize "Eldorado Tomater 400g" to "tomater"', () => {
      expect(ingredientService.normalizeIngredientName('Eldorado Tomater 400g')).to.equal('tomater');
    });
  });

  describe('syncScrapedIngredients', () => {
    it('should handle duplicate products for same ingredient', async () => {
      const similarProducts = [
        createTestProduct({ name: 'ICA Milk 1L', price: 12, store: 'ICA' }),
        createTestProduct({ name: 'Coop Milk 1L', price: 11, store: 'Coop' })
      ];

      await ingredientService.syncScrapedIngredients(similarProducts);

      const ingredients = await db.collection('normalized_ingredients').find({}).toArray();
      const milkIngredient = ingredients.find(i => i.name === 'milk');
      
      // Should have original product + 2 new products (test data has 3 total)
      expect(milkIngredient.products).to.have.lengthOf(3);
      // Verify new product was added
      expect(milkIngredient.products.map(p => p.store))
        .to.include.members(['ICA', 'Coop']);
      // Total ingredients should remain 3 (milk, pasta, beef)
      expect(ingredients).to.have.lengthOf(3); 
    });
  });

  describe('searchIngredients', () => {
    it('should search ingredients by name', async () => {
      const results = await ingredientService.searchIngredients('milk');
      expect(results).to.have.lengthOf(1);
      expect(results[0].name).to.equal('milk');
      expect(results[0].category).to.equal('dairy');
    });

    it('should filter by category', async () => {
      const results = await ingredientService.searchIngredients('', { category: 'dairy' });
      expect(results).to.have.lengthOf(1);
      expect(results[0].category).to.equal('dairy');
    });
  });

  describe('getIngredientCategories', () => {
    it('should return categories with correct counts', async () => {
      // Clear previous test data
      await db.collection('normalized_ingredients').deleteMany({});
      
      // Insert fresh test data
      await db.collection('normalized_ingredients').insertMany([
        { name: 'milk', category: 'dairy' },
        { name: 'cheese', category: 'dairy' },
        { name: 'beef', category: 'meat' }
      ]);

      const categories = await ingredientService.getIngredientCategories();
      expect(categories).to.have.lengthOf(2);
      
      const dairyCategory = categories.find(c => c.category === 'dairy');
      const meatCategory = categories.find(c => c.category === 'meat');
      
      expect(dairyCategory.count).to.equal(2);
      expect(meatCategory.count).to.equal(1);
    });
  });
});
