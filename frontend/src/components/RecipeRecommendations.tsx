import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import { ScoredRecipe } from '../services/recommendation.service';
import { recommendationService } from '../services/recommendation.service';
import RecipeCard from './molecules/RecipeCard';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
  </div>
);

const RecipeRecommendations: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<{
    personalized: ScoredRecipe[];
    trending: ScoredRecipe[];
    seasonal: ScoredRecipe[];
  }>({
    personalized: [],
    trending: [],
    seasonal: [],
  });

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const [personalized, trending, seasonal] = await Promise.all([
          recommendationService.getPersonalizedRecommendations({ limit: 8 }),
          recommendationService.getTrendingRecipes(8),
          recommendationService.getSeasonalRecipes(8),
        ]);

        setRecommendations({
          personalized,
          trending: trending.map(recipe => ({ recipe, matchScore: 0, matchFactors: {} })),
          seasonal: seasonal.map(recipe => ({ recipe, matchScore: 0, matchFactors: {} })),
        });
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError('Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Paper sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="For You" />
          <Tab label="Trending" />
          <Tab label="Seasonal" />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          {recommendations.personalized.map(({ recipe, matchScore }) => (
            <Grid item key={recipe._id.toString()} xs={12} sm={6} md={3}>
              <RecipeCard
                recipe={recipe}
                matchScore={Math.round(matchScore * 100)}
              />
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Grid container spacing={3}>
          {recommendations.trending.map(({ recipe }) => (
            <Grid item key={recipe._id.toString()} xs={12} sm={6} md={3}>
              <RecipeCard recipe={recipe} />
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Grid container spacing={3}>
          {recommendations.seasonal.map(({ recipe }) => (
            <Grid item key={recipe._id.toString()} xs={12} sm={6} md={3}>
              <RecipeCard recipe={recipe} />
            </Grid>
          ))}
        </Grid>
      </TabPanel>
    </Paper>
  );
};

 