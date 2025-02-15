// Shopping Feature Module
export * from './controllers';
export * from './services';
export * from './repositories';
export * from './types';

// Re-export commonly used types
export type {
  ShoppingList,
  ShoppingItem,
  Store,
  StoreDeal,
  StoreProduct,
  ShoppingListStats,
  CreateShoppingListDTO,
  UpdateShoppingListDTO,
  CreateStoreDTO,
  UpdateStoreDTO,
} from './types/shopping.types';

// Re-export service singleton
export { ShoppingService } from './services/shopping.service';

// Re-export router
export { default as shoppingRouter } from './controllers/shopping.controller';

// Feature configuration
export const shoppingFeatureConfig = {
  name: 'shopping',
  description: 'Shopping list and store management functionality',
  version: '1.0.0',
  dependencies: ['user', 'recipe', 'ingredient'],
}; 