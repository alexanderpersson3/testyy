export const createTestProduct = (overrides = {}) => ({
  name: 'Test Product',
  price: 9.99,
  category: 'test',
  ...overrides,
});

export const createTestIngredient = (overrides = {}) => ({
  name: 'Test Ingredient',
  quantity: 1,
  unit: 'unit',
  ...overrides,
});
