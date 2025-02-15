import { ObjectId } from 'mongodb';;;;
export interface Location {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface BusinessHours {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  open: string; // HH:mm format
  close: string; // HH:mm format
  isClosed: boolean;
}

export interface Product {
  _id?: ObjectId;
  name: string;
  category: string;
  description?: string;
  unit: string;
  price: number;
  currency: string;
  inStock: boolean;
  quantity?: number;
  images?: string[];
  tags?: string[];
  seasonality?: {
    startMonth: number; // 1-12
    endMonth: number; // 1-12
  };
}

export interface SpecialDeal {
  _id?: ObjectId;
  title: string;
  description: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  startDate: Date;
  endDate: Date;
  products: ObjectId[];
  minimumPurchase?: number;
  maximumDiscount?: number;
  terms?: string;
}

export interface Supplier {
  _id?: ObjectId;
  name: string;
  description: string;
  type: 'farmer' | 'artisan' | 'market' | 'cooperative';
  location: Location;
  businessHours: BusinessHours[];
  contactInfo: {
    phone: string;
    email: string;
    website?: string;
  };
  products: Product[];
  specialDeals?: SpecialDeal[];
  rating?: {
    average: number;
    count: number;
  };
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verificationDate?: Date;
  verificationDetails?: {
    document: string;
    verifiedBy: ObjectId;
    notes?: string;
  };
  deliveryOptions: {
    pickup: boolean;
    delivery: boolean;
    deliveryRadius?: number; // in kilometers
    minimumOrder?: number;
    deliveryFee?: number;
  };
  paymentMethods: ('cash' | 'card' | 'online' | 'transfer')[];
  images?: {
    logo?: string;
    storefront?: string[];
    products?: string[];
  };
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierReview {
  _id?: ObjectId;
  supplierId: ObjectId;
  userId: ObjectId;
  rating: number;
  comment?: string;
  images?: string[];
  verifiedPurchase: boolean;
  helpful: number;
  reported: boolean;
  reportReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierSearchQuery {
  location?: {
    latitude: number;
    longitude: number;
    radius: number; // in kilometers
  };
  type?: Supplier['type'][];
  products?: string[];
  rating?: number;
  verificationStatus?: Supplier['verificationStatus'];
  deliveryOptions?: {
    pickup?: boolean;
    delivery?: boolean;
  };
  openNow?: boolean;
  specialDeals?: boolean;
  sortBy?: 'distance' | 'rating' | 'name';
  limit?: number;
  offset?: number;
}
