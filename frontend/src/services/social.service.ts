import { api } from '../utils/api';

export interface Comment {
  _id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
}

export interface FollowUser {
  id: string;
  name: string;
  followingSince: string;
}

class SocialService {
  async likeRecipe(recipeId: string): Promise<{ liked: boolean }> {
    const response = await api.post(`/recipes/${recipeId}/like`);
    return response.data;
  }

  async getLikes(recipeId: string): Promise<{ count: number; userLiked: boolean }> {
    const response = await api.get(`/recipes/${recipeId}/likes`);
    return response.data.data;
  }

  async addComment(recipeId: string, content: string): Promise<{ data: Comment }> {
    const response = await api.post(`/recipes/${recipeId}/comments`, { content });
    return response.data;
  }

  async getComments(recipeId: string): Promise<Comment[]> {
    const response = await api.get(`/recipes/${recipeId}/comments`);
    return response.data.data;
  }

  async followUser(userId: string): Promise<{ following: boolean }> {
    const response = await api.post(`/users/${userId}/follow`);
    return response.data;
  }

  async getFollowers(userId: string): Promise<FollowUser[]> {
    const response = await api.get(`/users/${userId}/followers`);
    return response.data.data;
  }

  async getFollowing(userId: string): Promise<FollowUser[]> {
    const response = await api.get(`/users/${userId}/following`);
    return response.data.data;
  }
}

export const socialService = new SocialService();
