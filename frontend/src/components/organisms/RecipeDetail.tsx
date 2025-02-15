import React, { ReactNode } from 'react';
import { Box, Typography, List, ListItem, ListItemText, Divider } from '@mui/material';
import { Recipe } from '../../services/recipe.service';

interface RecipeDetailProps {
  recipe: Recipe;
}

const RecipeDetail: React.FC<RecipeDetailProps> = ({ recipe }) => {
  const renderInstructionContent = (instruction: Recipe['instructions'][number]): ReactNode => {
    return (
      <React.Fragment>
        <div>{instruction.text}</div>
        {instruction.timer && (
          <div>
            Timer: {instruction.timer.duration} {instruction.timer.unit}
          </div>
        )}
        {instruction.image && (
          <Box
            component="img"
            src={instruction.image}
            alt={`Step ${instruction.step}`}
            sx={{ maxWidth: '100%', height: 'auto', mt: 1 }}
          />
        )}
      </React.Fragment>
    );
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {recipe.title}
      </Typography>
      <Typography variant="body1" gutterBottom>
        {recipe.description}
      </Typography>
      <Divider />
      <Typography variant="h6" gutterBottom>
        Ingredients
      </Typography>
      <List>
        {recipe.ingredients.map((ingredient, index) => (
          <ListItem key={index}>
            <ListItemText
              primary={`${ingredient.amount} ${ingredient.unit} ${ingredient.name}`}
              secondary={ingredient.notes}
            />
          </ListItem>
        ))}
      </List>
      <Divider />
      <Typography variant="h6" gutterBottom>
        Instructions
      </Typography>
      <List>
        {recipe.instructions.map((instruction, index) => (
          <ListItem key={index}>
            <ListItemText
              primary={`Step ${instruction.step}`}
              secondary={renderInstructionContent(instruction)}
            />
          </ListItem>
        ))}
      </List>
      <Divider />
      <Typography variant="h6" gutterBottom>
        Tags
      </Typography>
      <Typography variant="body1" gutterBottom>
        {recipe.tags.join(', ')}
      </Typography>
      <Divider />
      <Typography variant="h6" gutterBottom>
        Images
      </Typography>
      <List>
        {recipe.images.map((image, index) => (
          <ListItem key={index}>
            <Box
              component="img"
              src={image}
              alt={`Recipe image ${index + 1}`}
              sx={{ maxWidth: '100%', height: 'auto', mt: 1 }}
            />
          </ListItem>
        ))}
      </List>
      <Divider />
      <Typography variant="h6" gutterBottom>
        Prep Time
      </Typography>
      <Typography variant="body1" gutterBottom>
        {recipe.prepTime} minutes
      </Typography>
      <Divider />
      <Typography variant="h6" gutterBottom>
        Cook Time
      </Typography>
      <Typography variant="body1" gutterBottom>
        {recipe.cookTime} minutes
      </Typography>
      <Divider />
      <Typography variant="h6" gutterBottom>
        Servings
      </Typography>
      <Typography variant="body1" gutterBottom>
        {recipe.servings}
      </Typography>
      <Divider />
      <Typography variant="h6" gutterBottom>
        Difficulty
      </Typography>
      <Typography variant="body1" gutterBottom>
        {recipe.difficulty}
      </Typography>
    </Box>
  );
};

export default RecipeDetail;
