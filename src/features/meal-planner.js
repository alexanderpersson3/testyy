const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

class MealPlannerService {
  async createMealPlan(userId, planData) {
    const db = getDb();

    // Validate all recipe IDs exist
    const recipeIds = planData.meals.map(meal => new ObjectId(meal.recipe_id));
    const recipes = await db
      .collection('recipes')
      .find({
        _id: { $in: recipeIds },
      })
      .toArray();

    if (recipes.length !== recipeIds.length) {
      throw new Error('One or more recipe IDs are invalid');
    }

    const mealPlan = {
      user_id: new ObjectId(userId),
      start_date: new Date(planData.start_date),
      end_date: new Date(planData.end_date),
      meals: planData.meals.map(meal => ({
        ...meal,
        recipe_id: new ObjectId(meal.recipe_id),
        date: new Date(meal.date),
      })),
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await db.collection('meal_plans').insertOne(mealPlan);
    return result.insertedId;
  }

  async getMealPlans(userId, startDate, endDate) {
    const db = getDb();
    const query = {
      user_id: new ObjectId(userId),
    };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const mealPlans = await db
      .collection('meal_plans')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'recipes',
            localField: 'meals.recipe_id',
            foreignField: '_id',
            as: 'recipe_details',
          },
        },
        {
          $project: {
            start_date: 1,
            end_date: 1,
            meals: {
              $map: {
                input: '$meals',
                as: 'meal',
                in: {
                  date: '$$meal.date',
                  type: '$$meal.type',
                  servings: '$$meal.servings',
                  recipe: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$recipe_details',
                          as: 'recipe',
                          cond: { $eq: ['$$recipe._id', '$$meal.recipe_id'] },
                        },
                      },
                      0,
                    ],
                  },
                },
              },
            },
            created_at: 1,
            updated_at: 1,
          },
        },
      ])
      .toArray();

    return mealPlans;
  }

  async updateMealPlan(userId, planId, updates) {
    const db = getDb();

    if (updates.meals) {
      // Validate recipe IDs if meals are being updated
      const recipeIds = updates.meals.map(meal => new ObjectId(meal.recipe_id));
      const recipes = await db
        .collection('recipes')
        .find({
          _id: { $in: recipeIds },
        })
        .toArray();

      if (recipes.length !== recipeIds.length) {
        throw new Error('One or more recipe IDs are invalid');
      }

      updates.meals = updates.meals.map(meal => ({
        ...meal,
        recipe_id: new ObjectId(meal.recipe_id),
        date: new Date(meal.date),
      }));
    }

    if (updates.start_date) updates.start_date = new Date(updates.start_date);
    if (updates.end_date) updates.end_date = new Date(updates.end_date);
    updates.updated_at = new Date();

    const result = await db.collection('meal_plans').updateOne(
      {
        _id: new ObjectId(planId),
        user_id: new ObjectId(userId),
      },
      { $set: updates }
    );

    return result.modifiedCount > 0;
  }

  async deleteMealPlan(userId, planId) {
    const db = getDb();
    const result = await db.collection('meal_plans').deleteOne({
      _id: new ObjectId(planId),
      user_id: new ObjectId(userId),
    });

    return result.deletedCount > 0;
  }

  async generateShoppingList(userId, planId) {
    const db = getDb();
    const mealPlan = await db.collection('meal_plans').findOne({
      _id: new ObjectId(planId),
      user_id: new ObjectId(userId),
    });

    if (!mealPlan) {
      throw new Error('Meal plan not found');
    }

    const recipeIds = mealPlan.meals.map(meal => meal.recipe_id);
    const recipes = await db
      .collection('recipes')
      .find({
        _id: { $in: recipeIds },
      })
      .toArray();

    // Aggregate ingredients across all meals
    const ingredients = {};
    mealPlan.meals.forEach(meal => {
      const recipe = recipes.find(r => r._id.equals(meal.recipe_id));
      if (recipe) {
        recipe.ingredients.forEach(ingredient => {
          const key = `${ingredient.name}|${ingredient.unit}`;
          if (!ingredients[key]) {
            ingredients[key] = {
              name: ingredient.name,
              unit: ingredient.unit,
              amount: 0,
            };
          }
          ingredients[key].amount += ingredient.amount * (meal.servings / recipe.servings);
        });
      }
    });

    return Object.values(ingredients);
  }

  async saveRecipe(userId, recipeId, collectionName = 'default', notes = '') {
    const db = getDb();
    const savedRecipe = {
      user_id: new ObjectId(userId),
      recipe_id: new ObjectId(recipeId),
      collection: collectionName,
      notes: notes,
      saved_at: new Date(),
    };

    await db.collection('saved_recipes').insertOne(savedRecipe);
    return true;
  }

  async getSavedRecipes(userId, collection = null) {
    const db = getDb();
    const query = { user_id: new ObjectId(userId) };
    if (collection) {
      query.collection = collection;
    }

    const savedRecipes = await db
      .collection('saved_recipes')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'recipes',
            localField: 'recipe_id',
            foreignField: '_id',
            as: 'recipe',
          },
        },
        { $unwind: '$recipe' },
        {
          $project: {
            collection: 1,
            notes: 1,
            saved_at: 1,
            recipe: 1,
          },
        },
      ])
      .toArray();

    return savedRecipes;
  }

  async removeSavedRecipe(userId, recipeId) {
    const db = getDb();
    const result = await db.collection('saved_recipes').deleteOne({
      user_id: new ObjectId(userId),
      recipe_id: new ObjectId(recipeId),
    });

    return result.deletedCount > 0;
  }
}

module.exports = new MealPlannerService();
