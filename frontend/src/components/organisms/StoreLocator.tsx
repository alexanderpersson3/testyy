import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Button,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  MyLocation as MyLocationIcon,
  DirectionsCar as DirectionsIcon,
  AccessTime as TimeIcon,
  Phone as PhoneIcon,
  Language as WebsiteIcon,
} from '@mui/icons-material';
import { StoreWithDistance, mapService } from '../../services/map.service';
import { formatDistance, formatDuration } from '../../utils/format';
import { ObjectId } from 'mongodb';

interface StoreLocatorProps {
  onStoreSelect?: (store: StoreWithDistance) => void;
  selectedProducts?: string[]; // ObjectIds of products to filter stores by
  maxDistance?: number; // in meters
}

export const StoreLocator: React.FC<StoreLocatorProps> = ({
  onStoreSelect,
  selectedProducts,
  maxDistance = 10000, // 10km default
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [stores, setStores] = useState<StoreWithDistance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreWithDistance | null>(null);
  const [routeDetails, setRouteDetails] = useState<{
    distance: number;
    duration: number;
  } | null>(null);

  useEffect(() => {
    // Get user's location on component mount
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (location) {
      fetchNearbyStores();
    }
  }, [location, selectedProducts]);

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          setError('Unable to get your location. Please enter it manually.');
        }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }
  };

  const fetchNearbyStores = async () => {
    if (!location) return;

    try {
      setLoading(true);
      setError(null);
      const nearbyStores = await mapService.findNearbyStores(
        location.lat,
        location.lng,
        {
          maxDistance,
          filterByProducts: selectedProducts?.map(id => new ObjectId(id)),
          limit: 20,
        }
      );
      setStores(nearbyStores);
    } catch (err) {
      setError('Failed to fetch nearby stores');
      console.error('Error fetching stores:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const searchResults = await mapService.searchStores(searchQuery, {
        ...(location && {
          latitude: location.lat,
          longitude: location.lng,
          maxDistance,
        }),
      });
      setStores(searchResults);
    } catch (err) {
      setError('Failed to search stores');
      console.error('Error searching stores:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStoreSelect = async (store: StoreWithDistance) => {
    setSelectedStore(store);
    if (onStoreSelect) {
      onStoreSelect(store);
    }

    // Calculate route if we have user's location
    if (location) {
      try {
        const route = await mapService.calculateRoute(
          location,
          store._id.toString()
        );
        setRouteDetails({
          distance: route.distance,
          duration: route.duration,
        });
      } catch (err) {
        console.error('Error calculating route:', err);
      }
    }
  };

  const getOpenStatus = (store: StoreWithDistance) => {
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const hours = store.openingHours[day];

    if (!hours || hours.closed) {
      return <Chip label="Closed" color="error" size="small" />;
    }

    const currentTime = now.toLocaleTimeString('en-US', { hour12: false });
    if (currentTime >= hours.open && currentTime <= hours.close) {
      return <Chip label="Open" color="success" size="small" />;
    }

    return <Chip label="Closed" color="error" size="small" />;
  };

  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      <Stack spacing={2}>
        {/* Search Bar */}
        <Box>
          <TextField
            fullWidth
            placeholder="Search stores by name or location"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleSearch}>
                    <SearchIcon />
                  </IconButton>
                  <IconButton onClick={getCurrentLocation}>
                    <MyLocationIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Error Message */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box display="flex" justifyContent="center">
            <CircularProgress />
          </Box>
        )}

        {/* Store List */}
        <List>
          {stores.map((store) => (
            <ListItem
              key={store._id.toString()}
              button
              onClick={() => handleStoreSelect(store)}
              selected={selectedStore?._id === store._id}
              divider
            >
              <Stack spacing={1} width="100%">
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1">{store.name}</Typography>
                  {getOpenStatus(store)}
                </Box>

                <Typography variant="body2" color="text.secondary">
                  {store.address.street}, {store.address.city}
                </Typography>

                <Stack direction="row" spacing={2}>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <DirectionsIcon fontSize="small" />
                    <Typography variant="body2">
                      {formatDistance(store.distance)}
                    </Typography>
                  </Box>

                  {store.duration && (
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <TimeIcon fontSize="small" />
                      <Typography variant="body2">
                        {formatDuration(store.duration)}
                      </Typography>
                    </Box>
                  )}
                </Stack>

                {store.phone && (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <PhoneIcon fontSize="small" />
                    <Typography variant="body2">{store.phone}</Typography>
                  </Box>
                )}

                {store.website && (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <WebsiteIcon fontSize="small" />
                    <Typography variant="body2" component="a" href={store.website} target="_blank">
                      Visit Website
                    </Typography>
                  </Box>
                )}
              </Stack>
            </ListItem>
          ))}
        </List>

        {/* No Results Message */}
        {!loading && stores.length === 0 && (
          <Typography color="text.secondary" align="center">
            No stores found. Try adjusting your search or location.
          </Typography>
        )}

        {/* Selected Store Details */}
        {selectedStore && routeDetails && (
          <Paper elevation={2} sx={{ p: 2, mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Route to {selectedStore.name}
            </Typography>
            <Stack direction="row" spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Distance
                </Typography>
                <Typography>{formatDistance(routeDetails.distance)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Estimated Time
                </Typography>
                <Typography>{formatDuration(routeDetails.duration)}</Typography>
              </Box>
            </Stack>
            <Button
              variant="contained"
              startIcon={<DirectionsIcon />}
              fullWidth
              sx={{ mt: 2 }}
              onClick={() => {
                // Open in Google Maps
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${
                    selectedStore.location.coordinates[1]
                  },${selectedStore.location.coordinates[0]}`,
                  '_blank'
                );
              }}
            >
              Get Directions
            </Button>
          </Paper>
        )}
      </Stack>
    </Paper>
  );
}; 