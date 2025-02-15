import { connectToDb } from './connectDB';
import { Collection, Db } from 'mongodb';

const getCollection = (collectionName: string): (() => Promise<Collection>) => {
  return async () => {
    const db: Db = await connectToDb();
    return db.collection(collectionName);
  };
};

export const collections = {
  recipes: getCollection('recipes'),
  ingredient: getCollection('ingredient'),
  savedRecipe: getCollection('savedRecipe'),
  users: getCollection('users'),
  likes: getCollection('likes'),
  comments: getCollection('comments'),
  followers: getCollection('followers'),
  priceHistory: getCollection('priceHistory'),
  priceAlerts: getCollection('priceAlerts'),
};