import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '@mui/material';
import { recipeService } from '../services/recipe.service';
import RecipeForm from '../components/RecipeForm';
import { Recipe } from '../services/recipe.service';

export const CreateRecipe: React.FC = () => {
  const navigate = useNavigate();

  const handleSubmit = async (recipe: Partial<Recipe>) => {
    try {
      // Convert recipe data to FormData
      const formData = new FormData();
      Object.entries(recipe).forEach(([key, value]) => {
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

      const { recipeId } = await recipeService.createRecipe(formData);
      navigate(`/recipes/${recipeId}`);
    } catch (error) {
      console.error('Error creating recipe:', error);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <RecipeForm onSubmit={handleSubmit} />
    </Container>
  );
}; 