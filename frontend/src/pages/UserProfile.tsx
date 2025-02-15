import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Avatar,
  Tab,
  Tabs,
  Button,
  CircularProgress,
  Divider,
  Stack,
} from '@mui/material';
import {
  Edit as EditIcon,
  Favorite as FavoriteIcon,
  Restaurant as RecipeIcon,
  Star as RatingIcon,
  Comment as CommentIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { Recipe, UserStats, UserActivity } from '../services/recipe.service';
import { recipeService } from '../services/recipe.service';
import { authService, User } from '../services/auth.service';
import RecipeCard from '../components/molecules/RecipeCard';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

export const UserProfile: React.FC = () => {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [recentActivity, setRecentActivity] = useState<UserActivity[]>([]);
  const [profileUser, setProfileUser] = useState<User | null>(null);

  const isOwnProfile = currentUser?.id === id;

  useEffect(() => {
    if (id) {
      fetchUserData();
    }
  }, [id]);

  const fetchUserData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const [userRecipes, saved, stats, activity, userData] = await Promise.all([
        recipeService.getRecipesByAuthor(id),
        recipeService.getSavedRecipes(),
        recipeService.getUserStats(id),
        recipeService.getUserActivity(id),
        authService.getUserProfile(id),
      ]);

      setRecipes(userRecipes.recipes);
      setSavedRecipes(saved.recipes);
      setUserStats(stats);
      setRecentActivity(activity);
      setProfileUser(userData);
    } catch (err) {
      setError('Failed to load user data');
      console.error('Error fetching user data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
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
      {/* Profile Header */}
      <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
        <Grid container spacing={4} alignItems="center">
          <Grid item>
            <Avatar
              sx={{ width: 120, height: 120 }}
              src={profileUser?.avatar}
              alt={profileUser?.name || ''}
            />
          </Grid>
          <Grid item xs>
            <Typography variant="h4" gutterBottom>
              {profileUser?.name}
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {profileUser?.bio || 'No bio yet'}
            </Typography>
            {isOwnProfile && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => navigate('/settings/profile')}
              >
                Edit Profile
              </Button>
            )}
          </Grid>
          <Grid item xs={12} md="auto">
            <Stack direction={{ xs: 'row', md: 'column' }} spacing={3} alignItems="center">
              <Box textAlign="center">
                <Typography variant="h6">{userStats?.recipesCount || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Recipes</Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h6">{userStats?.savedRecipes || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Saved</Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h6">{userStats?.totalLikes || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Likes</Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h6">{userStats?.averageRating?.toFixed(1) || '0.0'}</Typography>
                <Typography variant="body2" color="text.secondary">Avg Rating</Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Content Tabs */}
      <Paper elevation={3} sx={{ mb: 4 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab icon={<RecipeIcon />} label="Recipes" />
          <Tab icon={<FavoriteIcon />} label="Saved" />
          <Tab icon={<RatingIcon />} label="Activity" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            {recipes.map((recipe) => (
              <Grid item xs={12} sm={6} md={4} key={recipe._id.toString()}>
                <RecipeCard recipe={recipe} />
              </Grid>
            ))}
            {recipes.length === 0 && (
              <Grid item xs={12}>
                <Typography align="center" color="text.secondary">
                  No recipes created yet
                </Typography>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            {savedRecipes.map((recipe) => (
              <Grid item xs={12} sm={6} md={4} key={recipe._id.toString()}>
                <RecipeCard recipe={recipe} />
              </Grid>
            ))}
            {savedRecipes.length === 0 && (
              <Grid item xs={12}>
                <Typography align="center" color="text.secondary">
                  No saved recipes yet
                </Typography>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Stack spacing={2} divider={<Divider />}>
            {recentActivity.map((activity, index) => (
              <Box key={index}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {new Date(activity.timestamp).toLocaleDateString()}
                </Typography>
                <Typography>
                  {activity.type === 'like' && (
                    <>
                      <FavoriteIcon color="error" sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Liked recipe "{activity.recipe.title}"
                    </>
                  )}
                  {activity.type === 'comment' && (
                    <>
                      <CommentIcon color="primary" sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Commented on "{activity.recipe.title}"
                    </>
                  )}
                  {activity.type === 'rating' && (
                    <>
                      <RatingIcon color="warning" sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Rated "{activity.recipe.title}" {activity.rating} stars
                    </>
                  )}
                </Typography>
              </Box>
            ))}
            {recentActivity.length === 0 && (
              <Typography align="center" color="text.secondary">
                No recent activity
              </Typography>
            )}
          </Stack>
        </TabPanel>
      </Paper>
    </Container>
  );
}; 