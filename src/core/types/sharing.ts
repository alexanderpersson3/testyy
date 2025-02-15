import { ObjectId } from 'mongodb';;;;
export type ShareChannel =
  | 'link' // Direct link sharing
  | 'email' // Email sharing
  | 'facebook' // Facebook sharing
  | 'twitter' // Twitter sharing
  | 'pinterest' // Pinterest sharing
  | 'whatsapp' // WhatsApp sharing
  | 'telegram' // Telegram sharing
  | 'embed'; // Embeddable widget

export type SharePermission =
  | 'view' // Can only view the recipe
  | 'comment' // Can view and comment
  | 'rate' // Can view, comment, and rate
  | 'fork'; // Can view, comment, rate, and create variations

export interface BaseShare {
  recipeId: ObjectId;
  userId: ObjectId;
  channel: ShareChannel;
  permission: SharePermission;
  token: string; // Unique share token
  isActive: boolean;
  expiresAt?: Date; // Optional expiration date
  maxUses?: number; // Optional maximum number of uses
  useCount: number; // Number of times the share has been used
  password?: string; // Optional password protection
  allowedEmails?: string[]; // Optional email restriction
  createdAt: Date;
  updatedAt: Date;
}

export interface Share extends BaseShare {
  _id?: ObjectId;
}

export interface ShareDocument extends BaseShare {
  _id: ObjectId;
}

export interface ShareWithDetails extends ShareDocument {
  recipe?: {
    _id: ObjectId;
    name: string;
    imageUrl?: string;
    description?: string;
  };
  user?: {
    _id: ObjectId;
    username: string;
    avatar?: string;
  };
}

export interface CreateShareDTO {
  channel: ShareChannel;
  permission: SharePermission;
  expiresAt?: Date;
  maxUses?: number;
  password?: string;
  allowedEmails?: string[];
}

export interface UpdateShareDTO {
  permission?: SharePermission;
  isActive?: boolean;
  expiresAt?: Date;
  maxUses?: number;
  password?: string;
  allowedEmails?: string[];
}

export interface ShareQuery {
  recipeId?: string;
  userId?: string;
  channel?: ShareChannel;
  isActive?: boolean;
  search?: string;
}

export interface ShareStats {
  totalShares: number;
  activeShares: number;
  totalUses: number;
  channelStats: {
    [key in ShareChannel]: {
      shares: number;
      uses: number;
    };
  };
}

export interface ShareAccess {
  token: string;
  password?: string;
  email?: string;
}

export interface ShareResult {
  success: boolean;
  share?: ShareWithDetails;
  url?: string;
  embedCode?: string;
  error?: {
    code: 'expired' | 'inactive' | 'max_uses' | 'invalid_password' | 'invalid_email' | 'not_found';
    message: string;
  };
}

export interface ShareMetrics {
  views: number;
  uniqueVisitors: number;
  shares: number;
  engagement: {
    comments: number;
    ratings: number;
    forks: number;
  };
  referrers: {
    [key: string]: number;
  };
}

export interface EmbedOptions {
  width?: string;
  height?: string;
  theme?: 'light' | 'dark';
  showImage?: boolean;
  showDescription?: boolean;
  showIngredients?: boolean;
  showInstructions?: boolean;
  showMetadata?: boolean;
  responsive?: boolean;
}
