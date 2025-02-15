import React, { createContext, useContext, useCallback, useState } from 'react';
import { ObjectId } from 'mongodb';
import { mapService, Store, StoreProduct, StoreDeal, StoreWithDistance, StoreProductWithStore } from '../services/map.service';

interface Coordinates {
  lat: number;
  lng: number;
}

interface MapContextType {
  findNearbyStores: (
    latitude: number,
    longitude: number,
    options?: {
      maxDistance?: number;
      limit?: number;
      filterByProducts?: ObjectId[];
    }
  ) => Promise<StoreWithDistance[]>;
  getStoreDeals: (storeId: ObjectId) => Promise<StoreDeal[]>;
  getStoreProducts: (storeId: ObjectId) => Promise<StoreProduct[]>;
  updateProductAvailability: (
    storeId: ObjectId,
    updates: { productId: ObjectId; inStock: boolean; price?: number }[]
  ) => Promise<void>;
  getProductAvailability: (
    productId: ObjectId,
    options?: {
      latitude?: number;
      longitude?: number;
      maxDistance?: number;
      limit?: number;
    }
  ) => Promise<StoreProductWithStore[]>;
  loading: boolean;
  error: Error | null;
  center: Coordinates;
  zoom: number;
  setCenter: (center: Coordinates) => void;
  setZoom: (zoom: number) => void;
}

const MapContext = createContext<MapContextType | null>(null);

export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap must be used within a MapProvider');
  }
  return context;
};

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [center, setCenter] = useState<Coordinates>({ lat: 0, lng: 0 });
  const [zoom, setZoom] = useState(13);

  const findNearbyStores = useCallback(
    async (
      latitude: number,
      longitude: number,
      options?: {
        maxDistance?: number;
        limit?: number;
        filterByProducts?: ObjectId[];
      }
    ) => {
      setLoading(true);
      setError(null);
      try {
        const stores = await mapService.findNearbyStores(latitude, longitude, options);
        return stores;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to find nearby stores');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getStoreDeals = useCallback(async (storeId: ObjectId) => {
    setLoading(true);
    setError(null);
    try {
      const deals = await mapService.getStoreDeals(storeId);
      return deals;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get store deals');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const getStoreProducts = useCallback(async (storeId: ObjectId) => {
    setLoading(true);
    setError(null);
    try {
      const products = await mapService.getStoreProducts(storeId);
      return products;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get store products');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProductAvailability = useCallback(
    async (
      storeId: ObjectId,
      updates: { productId: ObjectId; inStock: boolean; price?: number }[]
    ) => {
      setLoading(true);
      setError(null);
      try {
        await mapService.updateProductAvailability(storeId, updates);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update product availability');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getProductAvailability = useCallback(
    async (
      productId: ObjectId,
      options?: {
        latitude?: number;
        longitude?: number;
        maxDistance?: number;
        limit?: number;
      }
    ) => {
      setLoading(true);
      setError(null);
      try {
        const availability = await mapService.getProductAvailability(productId, options);
        return availability;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to get product availability');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const value = {
    findNearbyStores,
    getStoreDeals,
    getStoreProducts,
    updateProductAvailability,
    getProductAvailability,
    loading,
    error,
    center,
    zoom,
    setCenter,
    setZoom
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};
