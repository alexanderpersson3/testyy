const dbConnection = require("./connectDB");

const getCollection = (collection) => {
  return async () => {
    const db = await dbConnection.connectToDb();
    return await db.collection(collection);
  };
};

module.exports = {
  recipes: getCollection("recipes"),
  ingredient: getCollection("ingredient"),
  savedRecipe: getCollection("savedRecipe"),
  users: getCollection("users"),
  likes: getCollection("likes"),
  comments: getCollection("comments"),
  followers: getCollection("followers"),
  priceHistory: getCollection("priceHistory"),
  priceAlerts: getCollection("priceAlerts"),
};