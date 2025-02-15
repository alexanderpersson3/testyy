import React, { useState, useRef, ChangeEvent } from 'react';
import {
  Box,
  Button,
  TextField,
  Grid,
  Typography,
  Paper,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Input,
  SelectChangeEvent,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { Recipe } from '../services/recipe.service';
import { recipeService } from '../services/recipe.service';

interface RecipeFormProps {
  recipe?: Recipe;
  onSubmit: (recipe: Partial<Recipe>) => Promise<void>;
}

const RecipeForm: React.FC<RecipeFormProps> = ({ recipe, onSubmit }) => {
  const [formData, setFormData] = useState<Partial<Recipe>>(
    recipe || {
      title: '',
      description: '',
      ingredients: [],
      instructions: [],
      servings: 1,
      prepTime: 0,
      cookTime: 0,
      difficulty: 'medium',
      cuisine: '',
      tags: [],
      images: [],
    }
  );
  const [newTag, setNewTag] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: Number(value) }));
  };

  const handleSelectChange = (e: SelectChangeEvent<'easy' | 'medium' | 'hard'>) => {
    const { name, value } = e.target;
    if (name) {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddIngredient = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [
        ...(prev.ingredients || []),
        { name: '', amount: 0, unit: '', notes: '' },
      ],
    }));
  };

  const handleIngredientChange = (index: number, field: string, value: string | number) => {
    setFormData(prev => {
      const newIngredients = [...(prev.ingredients || [])];
      newIngredients[index] = {
        ...newIngredients[index],
        [field]: field === 'amount' ? Number(value) : value,
      };
      return { ...prev, ingredients: newIngredients };
    });
  };

  const handleRemoveIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients?.filter((_, i) => i !== index),
    }));
  };

  const handleAddInstruction = () => {
    const nextStep = (formData.instructions?.length || 0) + 1;
    setFormData(prev => ({
      ...prev,
      instructions: [
        ...(prev.instructions || []),
        { step: nextStep, text: '', image: undefined },
      ],
    }));
  };

  const handleInstructionChange = (index: number, text: string) => {
    setFormData(prev => {
      const newInstructions = [...(prev.instructions || [])];
      newInstructions[index] = {
        ...newInstructions[index],
        text,
      };
      return { ...prev, instructions: newInstructions };
    });
  };

  const handleRemoveInstruction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions
        ?.filter((_, i) => i !== index)
        .map((instruction, i) => ({ ...instruction, step: i + 1 })),
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove),
    }));
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      // Convert FileList to string[] for the Recipe type
      const imageUrls = Array.from(e.target.files).map(file => URL.createObjectURL(file));
      setFormData(prev => ({
        ...prev,
        images: imageUrls,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <Paper elevation={3} sx={{ p: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {recipe ? 'Edit Recipe' : 'Create New Recipe'}
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
        <Grid container spacing={3}>
          {/* Basic Info */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              name="title"
              label="Recipe Title"
              value={formData.title}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              multiline
              rows={3}
              name="description"
              label="Description"
              value={formData.description}
              onChange={handleChange}
            />
          </Grid>

          {/* Recipe Details */}
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              required
              type="number"
              name="servings"
              label="Servings"
              value={formData.servings}
              onChange={handleNumberChange}
              inputProps={{ min: 1 }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              required
              type="number"
              name="prepTime"
              label="Prep Time (minutes)"
              value={formData.prepTime}
              onChange={handleNumberChange}
              inputProps={{ min: 0 }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              required
              type="number"
              name="cookTime"
              label="Cook Time (minutes)"
              value={formData.cookTime}
              onChange={handleNumberChange}
              inputProps={{ min: 0 }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required>
              <InputLabel>Difficulty</InputLabel>
              <Select
                name="difficulty"
                value={formData.difficulty}
                onChange={handleSelectChange}
                label="Difficulty"
              >
                <MenuItem value="easy">Easy</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="hard">Hard</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              name="cuisine"
              label="Cuisine"
              value={formData.cuisine}
              onChange={handleChange}
            />
          </Grid>

          {/* Tags */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Tags
            </Typography>
            <Box sx={{ mb: 2 }}>
              {formData.tags?.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  onDelete={() => handleRemoveTag(tag)}
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Add Tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <Button
                variant="contained"
                onClick={handleAddTag}
                startIcon={<AddIcon />}
              >
                Add Tag
              </Button>
            </Stack>
          </Grid>

          {/* Ingredients */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Ingredients
            </Typography>
            {formData.ingredients?.map((ingredient, index) => (
              <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    required
                    label="Name"
                    value={ingredient.name}
                    onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    fullWidth
                    required
                    type="number"
                    label="Amount"
                    value={ingredient.amount}
                    onChange={(e) => handleIngredientChange(index, 'amount', e.target.value)}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    fullWidth
                    required
                    label="Unit"
                    value={ingredient.unit}
                    onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Notes"
                    value={ingredient.notes}
                    onChange={(e) => handleIngredientChange(index, 'notes', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={1}>
                  <IconButton onClick={() => handleRemoveIngredient(index)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button
              variant="outlined"
              onClick={handleAddIngredient}
              startIcon={<AddIcon />}
            >
              Add Ingredient
            </Button>
          </Grid>

          {/* Instructions */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Instructions
            </Typography>
            {formData.instructions?.map((instruction, index) => (
              <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={11}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={2}
                    label={`Step ${instruction.step}`}
                    value={instruction.text}
                    onChange={(e) => handleInstructionChange(index, e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={1}>
                  <IconButton onClick={() => handleRemoveInstruction(index)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button
              variant="outlined"
              onClick={handleAddInstruction}
              startIcon={<AddIcon />}
            >
              Add Step
            </Button>
          </Grid>

          {/* Image Upload */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Images
            </Typography>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            <Button
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              startIcon={<CloudUploadIcon />}
            >
              Upload Images
            </Button>
            {formData.images instanceof FileList && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Selected {formData.images.length} images
                </Typography>
              </Box>
            )}
          </Grid>

          {/* Submit Button */}
          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              sx={{ mt: 2 }}
            >
              {recipe ? 'Save Changes' : 'Create Recipe'}
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

export default RecipeForm; 