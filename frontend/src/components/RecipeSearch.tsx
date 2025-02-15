import React, { useState } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Button,
  Grid,
  Autocomplete,
  Slider,
  Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { RecipeSearchQuery } from '../services/recipe.service';

interface RecipeSearchProps {
  onSearch: (query: RecipeSearchQuery) => void;
  availableTags?: string[];
  availableCuisines?: string[];
}

const RecipeSearch: React.FC<RecipeSearchProps> = ({
  onSearch,
  availableTags = [],
  availableCuisines = [],
}) => {
  const [searchQuery, setSearchQuery] = useState<RecipeSearchQuery>({
    text: '',
    cuisine: '',
    difficulty: undefined,
    tags: [],
    maxPrepTime: undefined,
    minRating: undefined,
    sortBy: 'newest',
  });

  const handleSearch = () => {
    onSearch(searchQuery);
  };

  const handleTagChange = (_event: any, newTags: string[]) => {
    setSearchQuery((prev) => ({ ...prev, tags: newTags }));
  };

  const handlePrepTimeChange = (_event: Event, newValue: number | number[]) => {
    setSearchQuery((prev) => ({ ...prev, maxPrepTime: newValue as number }));
  };

  const handleRatingChange = (_event: Event, newValue: number | number[]) => {
    setSearchQuery((prev) => ({ ...prev, minRating: newValue as number }));
  };

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Search recipes"
            value={searchQuery.text}
            onChange={(e) =>
              setSearchQuery((prev) => ({ ...prev, text: e.target.value }))
            }
            InputProps={{
              endAdornment: (
                <Button
                  variant="contained"
                  onClick={handleSearch}
                  startIcon={<SearchIcon />}
                >
                  Search
                </Button>
              ),
            }}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Cuisine</InputLabel>
            <Select
              value={searchQuery.cuisine}
              label="Cuisine"
              onChange={(e) =>
                setSearchQuery((prev) => ({ ...prev, cuisine: e.target.value }))
              }
            >
              <MenuItem value="">All</MenuItem>
              {availableCuisines.map((cuisine) => (
                <MenuItem key={cuisine} value={cuisine}>
                  {cuisine}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Difficulty</InputLabel>
            <Select
              value={searchQuery.difficulty || ''}
              label="Difficulty"
              onChange={(e) =>
                setSearchQuery((prev) => ({
                  ...prev,
                  difficulty: e.target.value as 'easy' | 'medium' | 'hard' | undefined,
                }))
              }
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="easy">Easy</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="hard">Hard</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <Autocomplete
            multiple
            options={availableTags}
            value={searchQuery.tags}
            onChange={handleTagChange}
            renderInput={(params) => (
              <TextField {...params} label="Tags" placeholder="Select tags" />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  label={option}
                  {...getTagProps({ index })}
                  key={option}
                />
              ))
            }
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography gutterBottom>Maximum Preparation Time (minutes)</Typography>
          <Slider
            value={searchQuery.maxPrepTime || 120}
            onChange={handlePrepTimeChange}
            valueLabelDisplay="auto"
            min={0}
            max={180}
            step={15}
            marks={[
              { value: 0, label: '0' },
              { value: 60, label: '60' },
              { value: 120, label: '120' },
              { value: 180, label: '180' },
            ]}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography gutterBottom>Minimum Rating</Typography>
          <Slider
            value={searchQuery.minRating || 0}
            onChange={handleRatingChange}
            valueLabelDisplay="auto"
            min={0}
            max={5}
            step={0.5}
            marks={[
              { value: 0, label: '0' },
              { value: 2.5, label: '2.5' },
              { value: 5, label: '5' },
            ]}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={searchQuery.sortBy || 'newest'}
              label="Sort By"
              onChange={(e) =>
                setSearchQuery((prev) => ({ ...prev, sortBy: e.target.value }))
              }
            >
              <MenuItem value="newest">Newest</MenuItem>
              <MenuItem value="popular">Most Popular</MenuItem>
              <MenuItem value="rating">Highest Rated</MenuItem>
              <MenuItem value="time">Quickest</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RecipeSearch; 