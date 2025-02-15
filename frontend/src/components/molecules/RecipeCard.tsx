import React from 'react';
import { Card, CardContent, CardMedia, Typography, Box, Chip, Rating, LinearProgress } from '@mui/material';
import { AccessTime, Restaurant, Favorite } from '@mui/icons-material';
import { Recipe } from '../../services/recipe.service';
import { useNavigate } from 'react-router-dom';

interface RecipeCardProps {
  recipe: Recipe;
  matchScore?: number;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, matchScore }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/recipes/${recipe._id}`);
  };

  return (
    <Card 
      onClick={handleClick}
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        cursor: 'pointer',
        position: 'relative',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3,
          transition: 'all 0.3s ease-in-out'
        }
      }}
    >
      {matchScore !== undefined && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            bgcolor: 'primary.main',
            color: 'white',
            borderRadius: '12px',
            px: 1,
            py: 0.5,
            zIndex: 1,
          }}
        >
          <Typography variant="caption" fontWeight="bold">
            {matchScore}% Match
          </Typography>
        </Box>
      )}

      <CardMedia
        component="img"
        height="200"
        image={recipe.images[0] || '/placeholder-recipe.jpg'}
        alt={recipe.title}
        sx={{ objectFit: 'cover' }}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography gutterBottom variant="h6" component="h2" noWrap>
          {recipe.title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            mb: 2
          }}
        >
          {recipe.description}
        </Typography>

        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <AccessTime fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {recipe.totalTime || recipe.prepTime + recipe.cookTime} min
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Restaurant fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
            {recipe.difficulty}
          </Typography>
        </Box>

        {recipe.ratings && (
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Rating value={recipe.ratings.average} precision={0.5} size="small" readOnly />
            <Typography variant="body2" color="text.secondary">
              ({recipe.ratings.count})
            </Typography>
          </Box>
        )}

        {recipe.stats && (
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Favorite fontSize="small" color="error" />
            <Typography variant="body2" color="text.secondary">
              {recipe.stats.likes}
            </Typography>
          </Box>
        )}

        <Box display="flex" flexWrap="wrap" gap={0.5}>
          {recipe.tags.slice(0, 3).map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              sx={{ fontSize: '0.75rem' }}
            />
          ))}
          {recipe.tags.length > 3 && (
            <Chip
              label={`+${recipe.tags.length - 3}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          )}
        </Box>

        {recipe.nutritionalInfo && (
          <Box mt={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {recipe.nutritionalInfo.calories} cal · {recipe.nutritionalInfo.protein}g protein
            </Typography>
            <LinearProgress
              variant="determinate"
              value={(recipe.nutritionalInfo.protein / 50) * 100}
              sx={{ height: 4, borderRadius: 2 }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default RecipeCard; 