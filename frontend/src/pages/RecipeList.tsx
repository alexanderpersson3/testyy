import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Grid, Box, Typography, CircularProgress } from '@mui/material';
import { Recipe } from '../services/recipe.service';
import { recipeService } from '../services/recipe.service';
import RecipeCard from '../components/molecules/RecipeCard';
import RecipeSearch from '../components/RecipeSearch';

export const RecipeList: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRecipes = async (searchParams = {}) => {
    try {
      setLoading(true);
      const data = await recipeService.searchRecipes({
        limit: 20,
        sortBy: 'newest',
        ...searchParams
      });
      setRecipes(data);
    } catch (err) {
      setError('Failed to load recipes');
      console.error('Error fetching recipes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  const handleSearch = async (searchParams: any) => {
    await fetchRecipes(searchParams);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <RecipeSearch onSearch={handleSearch} />
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {recipes.map((recipe) => (
          <Grid item xs={12} sm={6} md={4} key={recipe._id.toString()}>
            <RecipeCard recipe={recipe} />
          </Grid>
        ))}
        
        {recipes.length === 0 && (
          <Grid item xs={12}>
            <Typography variant="h6" align="center" color="text.secondary">
              No recipes found. Try adjusting your search criteria.
            </Typography>
          </Grid>
        )}
      </Grid>
    </Container>
  );
}; 