import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  CardActions,
  CircularProgress,
  Container,
} from '@mui/material';
import { recipeService, Recipe as BackendRecipe } from '../services/recipe.service';
import { useAuth } from '../contexts/AuthContext';
import RecipeComments from './molecules/RecipeComments';
import { SocialButtons } from './molecules/SocialButtons';

type Recipe = {
  _id: string;
  title: string;
  description: string;
  imageUrl: string;
  userId: string;
  userName: string;
};

const RecipeManagement = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  const mapRecipeData = useCallback((recipe: BackendRecipe): Recipe => ({
    _id: recipe._id.toString(),
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.images[0] || '',
    userId: recipe.author?._id.toString() || '',
    userName: recipe.author?.name || 'Unknown Author'
  }), []);

  const toggleComments = (recipeId: string) => {
    setSelectedRecipe(selectedRecipe === recipeId ? null : recipeId);
  };

  useEffect(() => {
    const fetchRecipes = async () => {
      setLoading(true);
      try {
        const backendRecipes = await recipeService.searchRecipes({});
        setRecipes(backendRecipes.map(mapRecipeData));
      } catch (error) {
        console.error('Failed to fetch recipes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecipes();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Recipes
      </Typography>

      <Grid container spacing={4}>
        {recipes.map(recipe => (
          <Grid item xs={12} sm={6} md={4} key={recipe._id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {recipe.imageUrl && (
                <CardMedia
                  component="img"
                  sx={{ height: 200 }}
                  image={recipe.imageUrl}
                  alt={recipe.title}
                />
              )}
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h5" component="h2">
                  {recipe.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {recipe.description}
                </Typography>
                <Typography variant="subtitle2" color="primary" sx={{ mt: 2 }}>
                  By {recipe.userName}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'space-between' }}>
                <SocialButtons
                  recipeId={recipe._id}
                  userId={recipe.userId}
                  showFollow={true}
                />
              </CardActions>
              <Box 
                sx={{ 
                  p: 2, 
                  borderTop: 1, 
                  borderColor: 'divider',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
                onClick={() => toggleComments(recipe._id)}
              >
                <Typography variant="button" color="primary">
                  {selectedRecipe === recipe._id ? 'Hide Comments' : 'Show Comments'}
                </Typography>
              </Box>
              {selectedRecipe === recipe._id && (
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                  <RecipeComments
                    recipeId={recipe._id}
                    isAuthenticated={isAuthenticated}
                  />
                </Box>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default RecipeManagement;
