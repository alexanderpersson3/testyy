import React from 'react';
import { TextField, Button, Grid, Paper, Typography, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useFormik, FormikErrors, FormikTouched } from 'formik';
import * as Yup from 'yup';
import { Recipe } from '../../services/recipe.service';
import { ObjectId } from 'mongodb';

interface RecipeFormProps {
  initialRecipe?: Recipe;
  onSubmit: (recipe: Recipe) => void;
}

interface FormIngredient {
  name: string;
  amount: number;
  unit: string;
}

interface FormValues {
  _id: ObjectId;
  title: string;
  description: string;
  servings: number;
  ingredients: FormIngredient[];
  instructionSteps: string[];
  prepTime: number;
  cookTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  images: string[];
}

const validationSchema = Yup.object({
  title: Yup.string().required('Title is required'),
  description: Yup.string().required('Description is required'),
  servings: Yup.number().required('Servings is required').min(1),
  prepTime: Yup.number().required('Prep time is required').min(0),
  cookTime: Yup.number().required('Cook time is required').min(0),
  difficulty: Yup.string().oneOf(['easy', 'medium', 'hard'], 'Invalid difficulty level'),
  ingredients: Yup.array().of(
    Yup.object().shape({
      name: Yup.string().required('Ingredient name is required'),
      amount: Yup.number().required('Amount is required').min(0),
      unit: Yup.string().required('Unit is required'),
    })
  ),
  instructionSteps: Yup.array().of(
    Yup.string().required('Instruction step is required')
  ),
  tags: Yup.array().of(Yup.string()),
  images: Yup.array().of(Yup.string())
});

export const RecipeForm: React.FC<RecipeFormProps> = ({ initialRecipe, onSubmit }) => {
  const formik = useFormik<FormValues>({
    initialValues: {
      _id: initialRecipe?._id ?? new ObjectId(),
      title: initialRecipe?.title ?? '',
      description: initialRecipe?.description ?? '',
      servings: initialRecipe?.servings ?? 1,
      ingredients: initialRecipe?.ingredients ?? [{ name: '', amount: 0, unit: 'g' }],
      instructionSteps: initialRecipe?.instructions?.map(i => i.text) ?? [''],
      prepTime: initialRecipe?.prepTime ?? 0,
      cookTime: initialRecipe?.cookTime ?? 0,
      difficulty: initialRecipe?.difficulty ?? 'medium',
      tags: initialRecipe?.tags ?? [],
      images: initialRecipe?.images ?? []
    },
    validationSchema,
    onSubmit: (values) => {
      const recipe: Recipe = {
        ...values,
        instructions: values.instructionSteps.map((text, index) => ({
          step: index + 1,
          text
        })),
        stats: initialRecipe?.stats ?? {
          viewCount: 0,
          saveCount: 0,
          rating: 0,
          likes: 0,
          shares: 0,
          comments: 0
        },
        createdAt: initialRecipe?.createdAt ?? new Date(),
        updatedAt: new Date()
      };
      onSubmit(recipe);
    },
  });

  const getFieldError = (path: keyof FormValues): string | undefined => {
    const touched = formik.touched[path];
    const error = formik.errors[path];
    return touched && error ? String(error) : undefined;
  };

  const addIngredient = () => {
    const newIngredients = [...formik.values.ingredients, { name: '', amount: 0, unit: 'g' }];
    formik.setFieldValue('ingredients', newIngredients);
  };

  const removeIngredient = (index: number) => {
    const newIngredients = [...formik.values.ingredients];
    newIngredients.splice(index, 1);
    formik.setFieldValue('ingredients', newIngredients);
  };

  const addInstruction = () => {
    const newInstructions = [...formik.values.instructionSteps, ''];
    formik.setFieldValue('instructionSteps', newInstructions);
  };

  const removeInstruction = (index: number) => {
    const newInstructions = [...formik.values.instructionSteps];
    newInstructions.splice(index, 1);
    formik.setFieldValue('instructionSteps', newInstructions);
  };

  const getIngredientError = (index: number, field: keyof FormIngredient): string | undefined => {
    const touched = (formik.touched.ingredients as FormikTouched<FormIngredient>[] | undefined)?.[index]?.[field];
    const error = (formik.errors.ingredients as FormikErrors<FormIngredient>[] | undefined)?.[index]?.[field];
    return touched && error ? String(error) : undefined;
  };

  const getInstructionError = (index: number): string | undefined => {
    const touched = (formik.touched.instructionSteps as boolean[] | undefined)?.[index];
    const error = (formik.errors.instructionSteps as string[] | undefined)?.[index];
    return touched && error ? String(error) : undefined;
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 800, mx: 'auto', my: 4 }}>
      <form onSubmit={formik.handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom>
              {initialRecipe ? 'Edit Recipe' : 'Create New Recipe'}
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              name="title"
              label="Recipe Title"
              value={formik.values.title}
              onChange={formik.handleChange}
              error={Boolean(getFieldError('title'))}
              helperText={getFieldError('title')}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              name="description"
              label="Description"
              value={formik.values.description}
              onChange={formik.handleChange}
              error={Boolean(getFieldError('description'))}
              helperText={getFieldError('description')}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              name="prepTime"
              label="Prep Time (minutes)"
              value={formik.values.prepTime}
              onChange={formik.handleChange}
              error={Boolean(getFieldError('prepTime'))}
              helperText={getFieldError('prepTime')}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              name="cookTime"
              label="Cook Time (minutes)"
              value={formik.values.cookTime}
              onChange={formik.handleChange}
              error={Boolean(getFieldError('cookTime'))}
              helperText={getFieldError('cookTime')}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              select
              name="difficulty"
              label="Difficulty"
              value={formik.values.difficulty}
              onChange={formik.handleChange}
              error={Boolean(getFieldError('difficulty'))}
              helperText={getFieldError('difficulty')}
              SelectProps={{
                native: true,
              }}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Ingredients
            </Typography>
            {formik.values.ingredients.map((ingredient, index) => (
              <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                <Grid item xs={5}>
                  <TextField
                    fullWidth
                    name={`ingredients.${index}.name`}
                    label="Ingredient"
                    value={ingredient.name}
                    onChange={formik.handleChange}
                    error={Boolean(getIngredientError(index, 'name'))}
                    helperText={getIngredientError(index, 'name')}
                  />
                </Grid>
                <Grid item xs={2}>
                  <TextField
                    fullWidth
                    type="number"
                    name={`ingredients.${index}.amount`}
                    label="Amount"
                    value={ingredient.amount}
                    onChange={formik.handleChange}
                    error={Boolean(getIngredientError(index, 'amount'))}
                    helperText={getIngredientError(index, 'amount')}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    name={`ingredients.${index}.unit`}
                    label="Unit"
                    value={ingredient.unit}
                    onChange={formik.handleChange}
                    error={Boolean(getIngredientError(index, 'unit'))}
                    helperText={getIngredientError(index, 'unit')}
                  />
                </Grid>
                <Grid item xs={2}>
                  <IconButton
                    onClick={() => removeIngredient(index)}
                    disabled={formik.values.ingredients.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button
              startIcon={<AddIcon />}
              onClick={addIngredient}
              variant="outlined"
              sx={{ mt: 1 }}
            >
              Add Ingredient
            </Button>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Instructions
            </Typography>
            {formik.values.instructionSteps.map((step, index) => (
              <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                <Grid item xs={10}>
                  <TextField
                    fullWidth
                    multiline
                    name={`instructionSteps.${index}`}
                    label={`Step ${index + 1}`}
                    value={step}
                    onChange={formik.handleChange}
                    error={Boolean(getInstructionError(index))}
                    helperText={getInstructionError(index)}
                  />
                </Grid>
                <Grid item xs={2}>
                  <IconButton
                    onClick={() => removeInstruction(index)}
                    disabled={formik.values.instructionSteps.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button
              startIcon={<AddIcon />}
              onClick={addInstruction}
              variant="outlined"
              sx={{ mt: 1 }}
            >
              Add Step
            </Button>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              name="tags"
              label="Tags (comma-separated)"
              value={formik.values.tags.join(', ')}
              onChange={(e) => {
                const tagsArray = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean);
                formik.setFieldValue('tags', tagsArray);
              }}
              helperText="Enter tags separated by commas"
            />
          </Grid>

          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
            >
              {initialRecipe ? 'Update Recipe' : 'Create Recipe'}
            </Button>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
};
