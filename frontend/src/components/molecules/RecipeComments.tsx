import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  TextField,
  Button,
  Divider,
  Stack,
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';

import { socialService, Comment } from '../../services/social.service';
import { SocialButtons } from './SocialButtons';

interface RecipeCommentsProps {
  recipeId: string;
  isAuthenticated: boolean;
}

const RecipeComments: React.FC<RecipeCommentsProps> = ({ recipeId, isAuthenticated }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [recipeId]);

  const loadComments = async () => {
    try {
      setIsLoading(true);
      const commentsData = await socialService.getComments(recipeId);
      setComments(commentsData);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setIsSubmitting(true);
      await socialService.addComment(recipeId, newComment);
      await loadComments(); // Reload comments after adding new one
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6">Comments</Typography>
        <SocialButtons recipeId={recipeId} showFollow={false} />
      </Box>

      {isAuthenticated ? (
        <Box component="form" onSubmit={handleAddComment} sx={{ mb: 4 }}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your thoughts about this recipe..."
              disabled={isSubmitting}
            />
            <Box display="flex" justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                disabled={!newComment.trim() || isSubmitting}
              >
                Post Comment
              </Button>
            </Box>
          </Stack>
        </Box>
      ) : (
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          Please sign in to leave a comment.
        </Typography>
      )}

      <List>
        {comments.map((comment, index) => (
          <React.Fragment key={comment._id}>
            {index > 0 && <Divider component="li" />}
            <ListItem alignItems="flex-start">
              <ListItemAvatar>
                <Avatar alt={comment.user.name}>
                  {comment.user.name[0]}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography component="span" variant="subtitle2" color="primary">
                      {comment.user.name}
                    </Typography>
                  </Box>
                }
                secondary={
                  <>
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.primary"
                      sx={{ display: 'block', my: 1 }}
                    >
                      {comment.content}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                      })}
                    </Typography>
                  </>
                }
              />
            </ListItem>
          </React.Fragment>
        ))}
        {comments.length === 0 && (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            No comments yet. Be the first to share your thoughts!
          </Typography>
        )}
      </List>
    </Box>
  );
};

export default RecipeComments;
