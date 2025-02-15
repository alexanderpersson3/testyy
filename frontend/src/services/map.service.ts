import { ObjectId } from 'mongodb';

export interface GeoLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface Store {
  _id: ObjectId;
  name: string;
  location: GeoLocation;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  openingHours: {
    [key: string]: {
      open: string;
      close: string;
      closed?: boolean;
    };
  };
  phone?: string;
  website?: string;
  rating?: number;
  photos?: string[];
  features?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreProduct {
  _id: ObjectId;
  storeId: ObjectId;
  productId: ObjectId;
  price: number;
  currency: string;
  inStock: boolean;
  aisle?: string;
  section?: string;
  lastChecked: Date;
  priceHistory: Array<{
    price: number;
    date: Date;
  }>;
}

export interface StoreDeal {
  _id: ObjectId;
  storeId: ObjectId;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  products: Array<{
    productId: ObjectId;
    discountedPrice: number;
    originalPrice: number;
    currency: string;
  }>;
  type: 'discount' | 'bogo' | 'bundle';
  terms?: string;
  active: boolean;
}

export interface StoreWithDistance extends Store {
  distance: number; // in meters
  duration?: number; // in seconds (if route calculated)
}

export interface StoreProductWithStore extends StoreProduct {
  store: Store;
}

export interface RouteOptions {
  mode?: 'driving' | 'walking' | 'bicycling' | 'transit';
  alternatives?: boolean;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
}

class MapService {
  private static instance: MapService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = `${import.meta.env.VITE_API_URL}/maps`;
  }

  public static getInstance(): MapService {
    if (!MapService.instance) {
      MapService.instance = new MapService();
    }
    return MapService.instance;
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

  // Find nearby stores
  async findNearbyStores(
    latitude: number,
    longitude: number,
    options: {
      maxDistance?: number; // in meters
      limit?: number;
      filterByProducts?: ObjectId[]; // only return stores that have these products
    } = {}
  ): Promise<StoreWithDistance[]> {
    const params = new URLSearchParams();
    params.append('lat', latitude.toString());
    params.append('lng', longitude.toString());
    
    if (options.maxDistance) {
      params.append('maxDistance', options.maxDistance.toString());
    }
    if (options.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options.filterByProducts) {
      options.filterByProducts.forEach(id => 
        params.append('products', id.toString())
      );
    }

    return this.request<StoreWithDistance[]>(`/stores/nearby?${params.toString()}`);
  }

  // Get store details
  async getStore(storeId: ObjectId): Promise<Store> {
    return this.request<Store>(`/stores/${storeId}`);
  }

  // Get store deals
  async getStoreDeals(storeId: ObjectId): Promise<StoreDeal[]> {
    return this.request<StoreDeal[]>(`/stores/${storeId}/deals`);
  }

  // Get store products
  async getStoreProducts(storeId: ObjectId): Promise<StoreProduct[]> {
    return this.request<StoreProduct[]>(`/stores/${storeId}/products`);
  }

  // Update product availability
  async updateProductAvailability(
    storeId: ObjectId,
    updates: Array<{
      productId: ObjectId;
      inStock: boolean;
      price?: number;
    }>
  ): Promise<void> {
    await this.request(`/stores/${storeId}/products/availability`, {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });
  }

  // Get product availability across stores
  async getProductAvailability(
    productId: ObjectId,
    options: {
      latitude?: number;
      longitude?: number;
      maxDistance?: number;
      limit?: number;
    } = {}
  ): Promise<StoreProductWithStore[]> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    return this.request<StoreProductWithStore[]>(
      `/products/${productId}/availability?${params.toString()}`
    );
  }

  // Calculate route to store
  async calculateRoute(
    origin: { lat: number; lng: number },
    storeId: ObjectId,
    options: RouteOptions = {}
  ): Promise<{
    distance: number;
    duration: number;
    polyline: string;
    steps: Array<{
      instruction: string;
      distance: number;
      duration: number;
      polyline: string;
    }>;
  }> {
    return this.request(`/routes`, {
      method: 'POST',
      body: JSON.stringify({
        origin,
        storeId,
        ...options,
      }),
    });
  }

  // Get store coverage areas
  async getStoreCoverageAreas(): Promise<Array<{
    area: {
      type: 'Polygon';
      coordinates: number[][][];
    };
    storeCount: number;
    averageDeliveryTime: number;
  }>> {
    return this.request('/coverage-areas');
  }

  // Search stores by query
  async searchStores(
    query: string,
    options: {
      latitude?: number;
      longitude?: number;
      maxDistance?: number;
      limit?: number;
    } = {}
  ): Promise<StoreWithDistance[]> {
    const params = new URLSearchParams({ query });
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    return this.request<StoreWithDistance[]>(`/stores/search?${params.toString()}`);
  }

  // Get store busy times
  async getStoreBusyTimes(storeId: ObjectId): Promise<{
    [day: string]: Array<{
      hour: number;
      busyness: 'low' | 'medium' | 'high';
      waitTime: number;
    }>;
  }> {
    return this.request(`/stores/${storeId}/busy-times`);
  }

  // Get optimized route for multiple stores
  async getOptimizedRoute(
    origin: { lat: number; lng: number },
    storeIds: ObjectId[],
    options: RouteOptions = {}
  ): Promise<{
    totalDistance: number;
    totalDuration: number;
    stores: Array<{
      store: Store;
      distance: number;
      duration: number;
      polyline: string;
    }>;
  }> {
    return this.request('/routes/optimize', {
      method: 'POST',
      body: JSON.stringify({
        origin,
        storeIds,
        ...options,
      }),
    });
  }
}

export const mapService = MapService.getInstance();
export default mapService;