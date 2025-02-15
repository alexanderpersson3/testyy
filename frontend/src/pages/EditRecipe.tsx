import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Container, Box, Typography, CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { Recipe } from '../services/recipe.service';
import { recipeService } from '../services/recipe.service';
import RecipeForm from '../components/RecipeForm';

interface RouteParams {
  id: string;
}

export const EditRecipe: React.FC = () => {
  const { id } = useParams() as RouteParams;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecipe();
  }, [id]);

  const fetchRecipe = async () => {
    try {
      setLoading(true);
      const data = await recipeService.getRecipe(id);
      
      // Check if user is the author
      if (data.author?._id.toString() !== user?.id) {
        navigate('/recipes');
        return;
      }
      
      setRecipe(data);
    } catch (err) {
      setError('Failed to load recipe');
      console.error('Error fetching recipe:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (recipeData: Partial<Recipe>) => {
    try {
      // Convert recipe data to FormData
      const formData = new FormData();
      Object.entries(recipeData).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'images' && value instanceof FileList) {
            Array.from(value).forEach(file => {
              formData.append('images', file);
            });
          } else if (Array.isArray(value) || typeof value === 'object') {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, value.toString());
          }
        }
      });

      await recipeService.updateRecipe(id, formData);
      navigate(`/recipes/${id}`);
    } catch (err) {
      console.error('Error updating recipe:', err);
    }
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

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <RecipeForm recipe={recipe} onSubmit={handleSubmit} />
    </Container>
  );
}; 