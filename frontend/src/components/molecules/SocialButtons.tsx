import React, { useEffect, useState } from 'react';
import { socialService } from '../../services/social.service';
import { FaHeart, FaRegHeart, FaUserPlus, FaUserMinus } from 'react-icons/fa';

interface SocialButtonsProps {
  recipeId?: string;
  userId?: string;
  showLike?: boolean;
  showFollow?: boolean;
}

export const SocialButtons: React.FC<SocialButtonsProps> = ({
  recipeId,
  userId,
  showLike = true,
  showFollow = true,
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (recipeId && showLike) {
      loadLikeStatus();
    }
  }, [recipeId]);

  const loadLikeStatus = async () => {
    try {
      const { count, userLiked } = await socialService.getLikes(recipeId!);
      setLikeCount(count);
      setIsLiked(userLiked);
    } catch (error) {
      console.error('Failed to load like status:', error);
    }
  };

  const handleLikeClick = async () => {
    if (!recipeId || isLoading) return;
    
    setIsLoading(true);
    try {
      const { liked } = await socialService.likeRecipe(recipeId);
      setIsLiked(liked);
      setLikeCount(prev => liked ? prev + 1 : prev - 1);
    } catch (error) {
      console.error('Failed to like recipe:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowClick = async () => {
    if (!userId || isLoading) return;
    
    setIsLoading(true);
    try {
      const { following } = await socialService.followUser(userId);
      setIsFollowing(following);
    } catch (error) {
      console.error('Failed to follow user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-4 items-center">
      {showLike && recipeId && (
        <button
          onClick={handleLikeClick}
          disabled={isLoading}
          className="flex items-center gap-2 text-red-500 hover:text-red-600 transition-colors"
          aria-label={isLiked ? 'Unlike recipe' : 'Like recipe'}
        >
          {isLiked ? <FaHeart /> : <FaRegHeart />}
          <span>{likeCount}</span>
        </button>
      )}

      {showFollow && userId && (
        <button
          onClick={handleFollowClick}
          disabled={isLoading}
          className="flex items-center gap-2 text-blue-500 hover:text-blue-600 transition-colors"
          aria-label={isFollowing ? 'Unfollow user' : 'Follow user'}
        >
          {isFollowing ? <FaUserMinus /> : <FaUserPlus />}
          <span>{isFollowing ? 'Following' : 'Follow'}</span>
        </button>
      )}
    </div>
  );
};
