import { MongoClient, ObjectId } from 'mongodb';
import { CollectionSortService } from '../src/services/collection-sort.service';
import { Recipe, RecipeCollection } from '../src/types/collections';
import { connectToDatabase } from '../src/db';

async function runPerformanceTests() {
  console.log('Starting performance tests...');

  const service = new CollectionSortService();
  const db = await connectToDatabase();

  // Create test data
  console.log('Creating test data...');

  // Create recipes with varying properties
  const recipes: Recipe[] = Array.from({ length: 10000 }, (_, i) => ({
    _id: new ObjectId(),
    title: `Recipe ${i}`,
    ingredients: Array.from({ length: 5 + (i % 10) }, (_, j) => ({
      name: `Ingredient ${j}`,
      amount: 100 + j * 50,
      unit: 'g',
    })),
    instructions: Array.from({ length: 3 + (i % 5) }, (_, j) => ({
      text: `Step ${j + 1}`,
      step: j + 1,
    })),
    difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard',
    totalTime: 15 + (i % 120),
    rating: 3 + (i % 20) / 10,
    cuisine:
      i % 5 === 0
        ? 'Italian'
        : i % 5 === 1
          ? 'Chinese'
          : i % 5 === 2
            ? 'Mexican'
            : i % 5 === 3
              ? 'Indian'
              : 'American',
    dietary:
      i % 4 === 0 ? ['vegetarian'] : i % 4 === 1 ? ['vegan'] : i % 4 === 2 ? ['gluten-free'] : [],
    tags: [`tag${i % 20}`, `category${i % 10}`, i % 3 === 0 ? 'quick' : 'elaborate'],
    createdAt: new Date(2024, 0, 1 + (i % 365)),
    updatedAt: new Date(2024, 0, 1 + (i % 365)),
  }));

  // Insert recipes
  await db.collection<Recipe>('recipes').insertMany(recipes);
  console.log(`Created ${recipes.length} recipes`);

  // Create collections of different sizes
  const collectionSizes = [10, 100, 1000, 10000];
  const collections: RecipeCollection[] = [];

  for (const size of collectionSizes) {
    const collection: RecipeCollection = {
      _id: new ObjectId(),
      userId: new ObjectId(),
      name: `Collection with ${size} recipes`,
      visibility: 'private',
      tags: [],
      recipes: recipes.slice(0, size).map(r => ({
        recipeId: r._id,
        position: 0,
        addedAt: new Date(),
      })),
      stats: {
        recipeCount: size,
        viewCount: 0,
        saveCount: 0,
        shareCount: 0,
        popularTags: [],
      },
      settings: {
        sortBy: 'name',
        sortDirection: 'asc',
        defaultView: 'grid',
        showNotes: true,
        showRatings: true,
        showCookingHistory: true,
        enableNotifications: true,
        autoAddToGroceryList: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    collections.push(collection);
  }

  // Insert collections
  await db.collection<RecipeCollection>('collections').insertMany(collections);
  console.log(`Created ${collections.length} collections`);

  // Test sorting performance
  console.log('\nTesting sorting performance...');
  const sortFields: Array<'name' | 'rating' | 'difficulty' | 'cookingTime'> = [
    'name',
    'rating',
    'difficulty',
    'cookingTime',
  ];

  for (const collection of collections) {
    console.log(`\nCollection size: ${collection.recipes.length} recipes`);

    for (const field of sortFields) {
      const start = Date.now();
      await service.sortCollectionRecipes(collection._id!.toString(), {
        field,
        direction: 'desc',
      });
      const duration = Date.now() - start;

      console.log(`Sort by ${field}: ${duration}ms`);
    }
  }

  // Test filtering performance
  console.log('\nTesting filtering performance...');
  const filters = [
    {
      name: 'Simple tag filter',
      filter: { tags: ['quick'] },
    },
    {
      name: 'Rating range',
      filter: { rating: { min: 4.0, max: 5.0 } },
    },
    {
      name: 'Complex filter',
      filter: {
        tags: ['quick'],
        rating: { min: 4.0 },
        difficulty: ['easy' as const],
        cookingTime: { max: 30 },
        ingredients: {
          include: ['Ingredient 0'],
          exclude: ['Ingredient 4'],
        },
        dietary: ['vegetarian'],
      },
    },
  ];

  for (const collection of collections) {
    console.log(`\nCollection size: ${collection.recipes.length} recipes`);

    for (const { name, filter } of filters) {
      const start = Date.now();
      const result = await service.filterCollectionRecipes(collection._id!.toString(), filter);
      const duration = Date.now() - start;

      console.log(`${name}: ${duration}ms, matched ${result.recipes.length} recipes`);
    }
  }

  // Test concurrent operations
  console.log('\nTesting concurrent operations...');
  const largestCollection = collections[collections.length - 1];

  const start = Date.now();
  await Promise.all([
    service.sortCollectionRecipes(largestCollection._id!.toString(), {
      field: 'rating',
      direction: 'desc',
    }),
    service.filterCollectionRecipes(largestCollection._id!.toString(), {
      rating: { min: 4.0 },
    }),
    service.sortCollectionRecipes(largestCollection._id!.toString(), {
      field: 'difficulty',
      direction: 'asc',
    }),
    service.filterCollectionRecipes(largestCollection._id!.toString(), {
      tags: ['quick'],
    }),
  ]);
  const duration = Date.now() - start;

  console.log(`Concurrent operations completed in ${duration}ms`);

  // Memory usage
  const used = process.memoryUsage();
  console.log('\nMemory usage:');
  for (const [key, value] of Object.entries(used)) {
    console.log(`${key}: ${Math.round((value / 1024 / 1024) * 100) / 100} MB`);
  }

  // Cleanup
  console.log('\nCleaning up...');
  await db.collection('recipes').deleteMany({});
  await db.collection('collections').deleteMany({});

  console.log('Performance tests completed');
  process.exit(0);
}

runPerformanceTests().catch(error => {
  console.error('Performance test failed:', error);
  process.exit(1);
});
