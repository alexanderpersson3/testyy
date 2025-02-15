import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Chip,
  Rating,
  Divider,
  List,
  ListItem,
  ListItemText,
  Button,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stack,
  Slider,
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  Share,
  Edit,
  Delete,
  Report,
  ContentCopy,
  Timer,
  Restaurant,
  LocalDining,
  People,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { Recipe } from '../services/recipe.service';
import { recipeService } from '../services/recipe.service';
import RecipeComments from '../components/molecules/RecipeComments';
import RecipeImageGallery from '../components/molecules/RecipeImageGallery';
import NutritionalInfo from '../components/molecules/NutritionalInfo';
import IngredientPrices from '../components/molecules/IngredientPrices';

interface RouteParams {
  id: string;
}

export const RecipeDetail: React.FC = () => {
  const { id } = useParams() as RouteParams;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState<'inappropriate' | 'copyright' | 'spam' | 'other'>('inappropriate');
  const [reportDescription, setReportDescription] = useState('');
  const [servingMultiplier, setServingMultiplier] = useState(1);

  useEffect(() => {
    if (id) {
      fetchRecipe();
      fetchComments();
    }
  }, [id]);

  const fetchRecipe = async () => {
    try {
      setLoading(true);
      const data = await recipeService.getRecipe(id!);
      setRecipe(data);
      // Also fetch recipe stats
      const stats = await recipeService.getRecipeStats(id!);
      setRecipe(prev => prev ? { ...prev, stats } : null);
    } catch (err) {
      setError('Failed to load recipe');
      console.error('Error fetching recipe:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const data = await recipeService.getComments(id!);
      setComments(data.comments);
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  const handleLike = async () => {
    try {
      const result = await recipeService.likeRecipe(id!);
      setLiked(result.liked);
      fetchRecipe(); // Refresh stats
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handleShare = async (platform: 'facebook' | 'twitter' | 'pinterest' | 'email') => {
    try {
      await recipeService.shareRecipe(id!, platform);
      setShareDialogOpen(false);
      fetchRecipe(); // Refresh stats
    } catch (err) {
      console.error('Error sharing recipe:', err);
    }
  };

  const handleReport = async () => {
    try {
      await recipeService.reportRecipe(id!, reportReason, reportDescription);
      setReportDialogOpen(false);
    } catch (err) {
      console.error('Error reporting recipe:', err);
    }
  };

  const handleAddComment = async (content: string, rating?: number) => {
    try {
      await recipeService.addComment(id!, content);
      if (rating) {
        await recipeService.addRating(id!, rating);
      }
      fetchComments();
      fetchRecipe(); // Refresh stats
    } catch (err) {
      console.error('Error adding comment:', err);
      throw err; // Re-throw to be handled by the RecipeComments component
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this recipe?')) return;
    try {
      await recipeService.deleteRecipe(id!);
      navigate('/recipes');
    } catch (err) {
      console.error('Error deleting recipe:', err);
    }
  };

  const handleRemix = async () => {
    try {
      const { recipeId } = await recipeService.remixRecipe(id!);
      navigate(`/recipes/${recipeId}/edit`);
    } catch (err) {
      console.error('Error remixing recipe:', err);
    }
  };

  const scaleIngredient = (amount: number) => {
    return (amount * servingMultiplier).toFixed(1);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !recipe) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <Typography color="error">{error || 'Recipe not found'}</Typography>
      </Box>
    );
  }

  const isOwner = user?.id === recipe.author?._id.toString();

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {recipe.title}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            {recipe.description}
          </Typography>
          
          {/* Author and Stats */}
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">
              By {recipe.author?.name}
            </Typography>
            <Rating value={recipe.ratings?.average || 0} precision={0.5} readOnly />
            <Typography variant="body2" color="text.secondary">
              ({recipe.ratings?.count || 0} ratings)
            </Typography>
          </Stack>

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <Box sx={{ mb: 2 }}>
              {recipe.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
          )}

          {/* Action Buttons */}
          <Stack direction="row" spacing={1}>
            <IconButton onClick={handleLike} color={liked ? 'primary' : 'default'}>
              {liked ? <Favorite /> : <FavoriteBorder />}
            </IconButton>
            <IconButton onClick={() => setShareDialogOpen(true)}>
              <Share />
            </IconButton>
            {isOwner ? (
              <>
                <IconButton onClick={() => navigate(`/recipes/${id}/edit`)}>
                  <Edit />
                </IconButton>
                <IconButton onClick={handleDelete} color="error">
                  <Delete />
                </IconButton>
              </>
            ) : (
              <>
                <IconButton onClick={handleRemix}>
                  <ContentCopy />
                </IconButton>
                <IconButton onClick={() => setReportDialogOpen(true)} color="warning">
                  <Report />
                </IconButton>
              </>
            )}
          </Stack>
        </Box>

        {/* Image Gallery */}
        <Box sx={{ mb: 4 }}>
          <RecipeImageGallery images={recipe.images} />
        </Box>

        {/* Recipe Info */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Timer />
                  <Typography>
                    Prep: {recipe.prepTime}min | Cook: {recipe.cookTime}min
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <Restaurant />
                  <Typography>
                    Difficulty: {recipe.difficulty}
                  </Typography>
                </Box>
                <Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <People />
                    <Typography>
                      Servings: {Math.round(recipe.servings * servingMultiplier)}
                    </Typography>
                  </Box>
                  <Slider
                    value={servingMultiplier}
                    onChange={(_, value) => setServingMultiplier(value as number)}
                    min={0.5}
                    max={4}
                    step={0.5}
                    marks
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}x`}
                    sx={{ mt: 2 }}
                  />
                </Box>
              </Stack>
            </Paper>
          </Grid>

          {recipe.nutritionalInfo && (
            <Grid item xs={12} md={8}>
              <NutritionalInfo
                info={recipe.nutritionalInfo}
                servings={Math.round(recipe.servings * servingMultiplier)}
              />
            </Grid>
          )}
        </Grid>

        <Divider sx={{ my: 4 }} />

        {/* Price Comparison Section */}
        <IngredientPrices
          ingredients={recipe.ingredients.map(ingredient => ({
            productId: ingredient.productId || '', // Add productId to Recipe interface
            name: ingredient.name,
            amount: ingredient.amount,
            unit: ingredient.unit,
          }))}
          servings={Math.round(recipe.servings * servingMultiplier)}
          onStoreSelect={(storeId) => {
            // Handle store selection, e.g., open map or navigate to store page
            console.log('Selected store:', storeId);
          }}
        />

        <Divider sx={{ my: 4 }} />

        {/* Ingredients and Instructions */}
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Typography variant="h6" gutterBottom>
              Ingredients
            </Typography>
            <List>
              {recipe.ingredients.map((ingredient, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={`${scaleIngredient(ingredient.amount)} ${ingredient.unit} ${ingredient.name}`}
                    secondary={ingredient.notes}
                  />
                </ListItem>
              ))}
            </List>
          </Grid>

          <Grid item xs={12} md={8}>
            <Typography variant="h6" gutterBottom>
              Instructions
            </Typography>
            <List>
              {recipe.instructions.map((instruction, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={`Step ${instruction.step}`}
                    secondary={instruction.text}
                  />
                </ListItem>
              ))}
            </List>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4 }} />

        {/* Comments Section */}
        <RecipeComments
          comments={comments}
          onAddComment={handleAddComment}
          isAuthenticated={!!user}
        />
      </Paper>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)}>
        <DialogTitle>Share Recipe</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Button onClick={() => handleShare('facebook')}>Share on Facebook</Button>
            <Button onClick={() => handleShare('twitter')}>Share on Twitter</Button>
            <Button onClick={() => handleShare('pinterest')}>Share on Pinterest</Button>
            <Button onClick={() => handleShare('email')}>Share via Email</Button>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onClose={() => setReportDialogOpen(false)}>
        <DialogTitle>Report Recipe</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              select
              fullWidth
              label="Reason"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value as typeof reportReason)}
            >
              <MenuItem value="inappropriate">Inappropriate Content</MenuItem>
              <MenuItem value="copyright">Copyright Violation</MenuItem>
              <MenuItem value="spam">Spam</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              placeholder="Please provide more details about your report..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleReport} color="primary" variant="contained">
            Submit Report
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default RecipeDetail; 