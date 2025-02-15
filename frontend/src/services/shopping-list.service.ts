import { ObjectId } from 'mongodb';
import { wsService } from './websocket.service';

export interface ShoppingListItem {
  _id: ObjectId;
  name: string;
  amount: number;
  unit: string;
  checked: boolean;
  notes?: string;
  productId?: string;
  category?: string;
  addedBy: {
    _id: ObjectId;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ShoppingList {
  _id: ObjectId;
  name: string;
  items: ShoppingListItem[];
  collaborators: Array<{
    userId: ObjectId;
    name: string;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: Date;
  }>;
  createdBy: {
    _id: ObjectId;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShoppingListDto {
  name: string;
  items?: Array<{
    name: string;
    amount: number;
    unit: string;
    notes?: string;
    productId?: string;
    category?: string;
  }>;
}

class ShoppingListService {
  private static instance: ShoppingListService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = `${import.meta.env.VITE_API_URL}/shopping-lists`;
  }

  public static getInstance(): ShoppingListService {
    if (!ShoppingListService.instance) {
      ShoppingListService.instance = new ShoppingListService();
    }
    return ShoppingListService.instance;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'An error occurred');
    }

    return response.json();
  }

  // Create shopping list
  async createList(data: CreateShoppingListDto): Promise<ShoppingList> {
    return this.request<ShoppingList>('/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Get user's shopping lists
  async getLists(): Promise<ShoppingList[]> {
    return this.request<ShoppingList[]>('/');
  }

  // Get shopping list by ID
  async getList(listId: string): Promise<ShoppingList> {
    return this.request<ShoppingList>(`/${listId}`);
  }

  // Update shopping list
  async updateList(listId: string, data: Partial<ShoppingList>): Promise<ShoppingList> {
    return this.request<ShoppingList>(`/${listId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Delete shopping list
  async deleteList(listId: string): Promise<void> {
    await this.request(`/${listId}`, {
      method: 'DELETE',
    });
  }

  // Add item to list
  async addItem(listId: string, item: Omit<ShoppingListItem, '_id' | 'checked' | 'addedBy' | 'createdAt' | 'updatedAt'>): Promise<ShoppingListItem> {
    return this.request<ShoppingListItem>(`/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  // Update item
  async updateItem(listId: string, itemId: string, data: Partial<ShoppingListItem>): Promise<ShoppingListItem> {
    return this.request<ShoppingListItem>(`/${listId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Delete item
  async deleteItem(listId: string, itemId: string): Promise<void> {
    await this.request(`/${listId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  // Add collaborator
  async addCollaborator(listId: string, userId: string, role: 'editor' | 'viewer'): Promise<void> {
    await this.request(`/${listId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
  }

  // Update collaborator role
  async updateCollaboratorRole(listId: string, userId: string, role: 'editor' | 'viewer'): Promise<void> {
    await this.request(`/${listId}/collaborators/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  // Remove collaborator
  async removeCollaborator(listId: string, userId: string): Promise<void> {
    await this.request(`/${listId}/collaborators/${userId}`, {
      method: 'DELETE',
    });
  }

  // Subscribe to real-time updates
  subscribeToList(listId: string, callback: (update: any) => void): () => void {
    return wsService.subscribe(`shopping_list:${listId}`, callback);
  }

  // Subscribe to all user's lists updates
  subscribeToUserLists(callback: (update: any) => void): () => void {
    return wsService.subscribe('shopping_lists', callback);
  }

  // Get price comparison for list items
  async getPriceComparison(listId: string, options?: {
    maxDistance?: number;
    latitude?: number;
    longitude?: number;
    maxStores?: number;
  }): Promise<{
    stores: Array<{
      store: {
        _id: ObjectId;
        name: string;
        distance: number;
      };
      totalPrice: number;
      currency: string;
      items: Array<{
        productId: string;
        price: number;
        inStock: boolean;
      }>;
    }>;
  }> {
    const params = new URLSearchParams();
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }
    return this.request(`/${listId}/price-comparison?${params.toString()}`);
  }

  // Get list statistics
  async getListStats(listId: string): Promise<{
    totalItems: number;
    checkedItems: number;
    totalPrice: number;
    priceHistory: Array<{
      date: Date;
      totalPrice: number;
    }>;
    mostFrequentItems: Array<{
      name: string;
      count: number;
    }>;
  }> {
    return this.request(`/${listId}/stats`);
  }
}

export const shoppingListService = ShoppingListService.getInstance();
export default shoppingListService; 