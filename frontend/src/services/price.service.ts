import { ObjectId } from 'mongodb';

export interface PriceHistory {
  _id: ObjectId;
  productId: ObjectId;
  storeId: ObjectId;
  price: number;
  currency: string;
  unit: string;
  timestamp: Date;
}

export interface PriceAlert {
  _id: ObjectId;
  userId: ObjectId;
  productId: ObjectId;
  targetPrice: number;
  currency: string;
  notifyAbove: boolean;
  notifyBelow: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Store {
  _id: ObjectId;
  name: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  address: string;
  openingHours: {
    [key: string]: {
      open: string;
      close: string;
    };
  };
}

export interface PriceComparison {
  product: {
    _id: ObjectId;
    name: string;
    brand?: string;
    category: string;
    unit: string;
  };
  prices: Array<{
    store: Store;
    currentPrice: number;
    currency: string;
    lastUpdated: Date;
    priceHistory: PriceHistory[];
  }>;
}

class PriceService {
  private static instance: PriceService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = `${import.meta.env.VITE_API_URL}/prices`;
  }

  public static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
      throw new Error(error.message || 'Failed to fetch price data');
    }

    return response.json();
  }

  // Get current prices for a product across all stores
  async getProductPrices(productId: string): Promise<PriceComparison> {
    return this.request<PriceComparison>(`/products/${productId}`);
  }

  // Get price history for a product at a specific store
  async getPriceHistory(
    productId: string,
    storeId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      interval?: 'day' | 'week' | 'month';
    } = {}
  ): Promise<PriceHistory[]> {
    const params = new URLSearchParams();
    if (options.startDate) params.append('startDate', options.startDate.toISOString());
    if (options.endDate) params.append('endDate', options.endDate.toISOString());
    if (options.interval) params.append('interval', options.interval);

    return this.request<PriceHistory[]>(
      `/products/${productId}/stores/${storeId}/history?${params.toString()}`
    );
  }

  // Create a price alert
  async createPriceAlert(
    productId: string,
    data: {
      targetPrice: number;
      currency: string;
      notifyAbove?: boolean;
      notifyBelow?: boolean;
    }
  ): Promise<PriceAlert> {
    return this.request<PriceAlert>(`/alerts`, {
      method: 'POST',
      body: JSON.stringify({
        productId,
        ...data,
      }),
    });
  }

  // Get user's price alerts
  async getPriceAlerts(options: {
    active?: boolean;
    productId?: string;
  } = {}): Promise<PriceAlert[]> {
    const params = new URLSearchParams();
    if (typeof options.active === 'boolean') params.append('active', options.active.toString());
    if (options.productId) params.append('productId', options.productId);

    return this.request<PriceAlert[]>(`/alerts?${params.toString()}`);
  }

  // Update price alert
  async updatePriceAlert(
    alertId: string,
    data: Partial<Omit<PriceAlert, '_id' | 'userId' | 'productId' | 'createdAt' | 'updatedAt'>>
  ): Promise<PriceAlert> {
    return this.request<PriceAlert>(`/alerts/${alertId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Delete price alert
  async deletePriceAlert(alertId: string): Promise<void> {
    await this.request(`/alerts/${alertId}`, {
      method: 'DELETE',
    });
  }

  // Get best prices for a shopping list
  async getBestPrices(
    items: Array<{
      productId: string;
      quantity: number;
      unit: string;
    }>,
    options: {
      maxDistance?: number;
      latitude?: number;
      longitude?: number;
      maxStores?: number;
    } = {}
  ): Promise<{
    recommendations: Array<{
      store: Store;
      totalPrice: number;
      currency: string;
      items: Array<{
        productId: string;
        price: number;
        quantity: number;
      }>;
      distance?: number;
    }>;
  }> {
    return this.request('/optimize', {
      method: 'POST',
      body: JSON.stringify({
        items,
        ...options,
      }),
    });
  }

  // Get price trends and analytics
  async getPriceTrends(
    productId: string,
    options: {
      period?: 'week' | 'month' | 'year';
      aggregation?: 'avg' | 'min' | 'max';
    } = {}
  ): Promise<{
    trend: 'up' | 'down' | 'stable';
    changePercent: number;
    forecast: Array<{
      date: string;
      price: number;
    }>;
    statistics: {
      average: number;
      minimum: number;
      maximum: number;
      standardDeviation: number;
    };
  }> {
    const params = new URLSearchParams();
    if (options.period) params.append('period', options.period);
    if (options.aggregation) params.append('aggregation', options.aggregation);

    return this.request(`/products/${productId}/trends?${params.toString()}`);
  }

  // Report incorrect price
  async reportPrice(
    productId: string,
    storeId: string,
    data: {
      reportedPrice: number;
      currency: string;
      notes?: string;
    }
  ): Promise<void> {
    await this.request(`/products/${productId}/stores/${storeId}/report`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const priceService = PriceService.getInstance();
export default priceService; 