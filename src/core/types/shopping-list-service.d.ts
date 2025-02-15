import { ShoppingListItem } from '../shopping-list.js';;
import { IngredientWithPrices } from '../ingredient.js';;

export interface ExtendedShoppingListItem extends ShoppingListItem {
  ingredient?: IngredientWithPrices;
}

export interface CollaboratorInput {
  userId: string | ObjectId;
  role: 'editor' | 'viewer';
}

export interface CollaboratorOperation {
  userId: ObjectId;
  joinedAt: Date;
  role: 'editor' | 'viewer';
}
