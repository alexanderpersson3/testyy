import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  LinearProgress,
  Tooltip,
} from '@mui/material';

interface NutritionalInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar?: number;
}

interface NutritionalInfoProps {
  info: NutritionalInfo;
  servings: number;
}

const NutritionalInfo: React.FC<NutritionalInfoProps> = ({ info, servings }) => {
  // Daily recommended values (based on 2000 calorie diet)
  const dailyValues = {
    calories: 2000,
    protein: 50,
    carbs: 275,
    fat: 78,
    fiber: 28,
    sugar: 50,
  };

  const calculatePercentage = (value: number, recommended: number) => {
    return (value / recommended) * 100;
  };

  const formatValue = (value: number) => {
    return value.toFixed(1);
  };

  const perServing = {
    calories: info.calories / servings,
    protein: info.protein / servings,
    carbs: info.carbs / servings,
    fat: info.fat / servings,
    fiber: info.fiber / servings,
    sugar: info.sugar ? info.sugar / servings : undefined,
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Nutritional Information
      </Typography>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Per serving ({servings} servings)
      </Typography>

      <Grid container spacing={3}>
        {/* Calories */}
        <Grid item xs={12}>
          <Box>
            <Typography variant="subtitle2">Calories</Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2">
                {formatValue(perServing.calories)}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(calculatePercentage(perServing.calories, dailyValues.calories), 100)}
                sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary">
                {formatValue(calculatePercentage(perServing.calories, dailyValues.calories))}%
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Macronutrients */}
        {[
          { label: 'Protein', value: perServing.protein, daily: dailyValues.protein },
          { label: 'Carbs', value: perServing.carbs, daily: dailyValues.carbs },
          { label: 'Fat', value: perServing.fat, daily: dailyValues.fat },
          { label: 'Fiber', value: perServing.fiber, daily: dailyValues.fiber },
          ...(perServing.sugar ? [{ label: 'Sugar', value: perServing.sugar, daily: dailyValues.sugar }] : []),
        ].map((nutrient) => (
          <Grid item xs={6} key={nutrient.label}>
            <Tooltip
              title={`${formatValue(calculatePercentage(nutrient.value, nutrient.daily))}% of daily value`}
              arrow
            >
              <Box>
                <Typography variant="subtitle2">{nutrient.label}</Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2">
                    {formatValue(nutrient.value)}g
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(calculatePercentage(nutrient.value, nutrient.daily), 100)}
                    sx={{ flexGrow: 1, height: 4, borderRadius: 2 }}
                  />
                </Box>
              </Box>
            </Tooltip>
          </Grid>
        ))}
      </Grid>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        * Percent Daily Values are based on a 2,000 calorie diet.
      </Typography>
    </Paper>
  );
};

export default NutritionalInfo; 