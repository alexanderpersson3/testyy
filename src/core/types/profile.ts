
export interface UserProfile {
  _id?: ObjectId;
  userId: ObjectId;
  displayName: string;
  bio?: string;
  avatar?: string;
  coverImage?: string;
  socialLinks: {
    instagram?: string;
    facebook?: string;
    website?: string;
  };
  highlights: {
    _id?: ObjectId;
    title: string;
    description?: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    createdAt: Date;
  }[];
  stats: {
    followers: number;
    following: number;
    recipes: number;
    likes: number;
  };
  isPro: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  customization: {
    theme: 'light' | 'dark' | 'system';
    accentColor?: string;
    fontPreference?: string;
    layout: 'grid' | 'list';
    showStats: boolean;
    privacySettings: {
      profileVisibility: 'public' | 'followers' | 'private';
      storyComments: 'everyone' | 'followers' | 'none';
      allowSharing: boolean;
      showActivity: boolean;
    };
  };
}

export interface UserProfileDocument extends UserProfile {
  _id: ObjectId;
}
