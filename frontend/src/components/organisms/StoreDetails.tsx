import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  IconButton,
  Button,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Language as WebsiteIcon,
  AccessTime as TimeIcon,
  LocalOffer as DealIcon,
  DirectionsCar as DirectionsIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { Store, StoreDeal, mapService } from '../../services/map.service';
import { formatDistance } from '../../utils/format';

interface StoreDetailsProps {
  storeId: string;
  userLocation?: { lat: number; lng: number };
  onGetDirections?: () => void;
}

export const StoreDetails: React.FC<StoreDetailsProps> = ({
  storeId,
  userLocation,
  onGetDirections,
}) => {
  const [store, setStore] = useState<Store | null>(null);
  const [deals, setDeals] = useState<StoreDeal[]>([]);
  const [busyTimes, setBusyTimes] = useState<{
    [day: string]: Array<{
      hour: number;
      busyness: 'low' | 'medium' | 'high';
      waitTime: number;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    fetchStoreData();
  }, [storeId]);

  const fetchStoreData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [storeData, storeDeals, storeBusyTimes] = await Promise.all([
        mapService.getStore(storeId),
        mapService.getStoreDeals(storeId),
        mapService.getStoreBusyTimes(storeId),
      ]);

      setStore(storeData);
      setDeals(storeDeals);
      setBusyTimes(storeBusyTimes);

      // Calculate distance if user location is provided
      if (userLocation) {
        const route = await mapService.calculateRoute(userLocation, storeId);
        setDistance(route.distance);
      }
    } catch (err) {
      setError('Failed to load store information');
      console.error('Error fetching store data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentDayBusyness = () => {
    if (!busyTimes) return null;

    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const hour = now.getHours();

    const dayBusyness = busyTimes[day];
    if (!dayBusyness) return null;

    return dayBusyness.find(time => time.hour === hour);
  };

  const getBusynessColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      default: return 'inherit';
    }
  };

  const getOpenStatus = () => {
    if (!store) return null;

    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const hours = store.openingHours[day];

    if (!hours || hours.closed) {
      return <Chip label="Closed" color="error" />;
    }

    const currentTime = now.toLocaleTimeString('en-US', { hour12: false });
    if (currentTime >= hours.open && currentTime <= hours.close) {
      return <Chip label="Open" color="success" />;
    }

    return <Chip label="Closed" color="error" />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !store) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error || 'Store not found'}
      </Alert>
    );
  }

  const currentBusyness = getCurrentDayBusyness();

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* Header Section */}
        <Grid item xs={12}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" gutterBottom>
              {store.name}
            </Typography>
            {getOpenStatus()}
          </Stack>
          <Typography color="text.secondary">
            {store.address.street}, {store.address.city}, {store.address.state} {store.address.postalCode}
          </Typography>
          {distance && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {formatDistance(distance)} away
            </Typography>
          )}
        </Grid>

        {/* Contact Information */}
        <Grid item xs={12}>
          <Stack direction="row" spacing={2}>
            {store.phone && (
              <Button
                startIcon={<PhoneIcon />}
                variant="outlined"
                size="small"
                href={`tel:${store.phone}`}
              >
                Call
              </Button>
            )}
            {store.website && (
              <Button
                startIcon={<WebsiteIcon />}
                variant="outlined"
                size="small"
                href={store.website}
                target="_blank"
              >
                Website
              </Button>
            )}
            {onGetDirections && (
              <Button
                startIcon={<DirectionsIcon />}
                variant="contained"
                size="small"
                onClick={onGetDirections}
              >
                Get Directions
              </Button>
            )}
          </Stack>
        </Grid>

        {/* Current Busyness */}
        {currentBusyness && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <PeopleIcon color={getBusynessColor(currentBusyness.busyness) as 'success' | 'warning' | 'error' | 'inherit'} />
                  <Typography variant="subtitle2">
                    Current Store Traffic
                  </Typography>
                </Stack>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {currentBusyness.busyness === 'low' && 'Not too busy'}
                    {currentBusyness.busyness === 'medium' && 'Moderately busy'}
                    {currentBusyness.busyness === 'high' && 'Very busy'}
                    {' · '}{currentBusyness.waitTime} min wait time
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={
                      currentBusyness.busyness === 'low' ? 33 :
                      currentBusyness.busyness === 'medium' ? 66 : 100
                    }
                    color={getBusynessColor(currentBusyness.busyness) as 'success' | 'warning' | 'error' | 'inherit'}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>
              </Stack>
            </Paper>
          </Grid>
        )}

        {/* Opening Hours */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            Opening Hours
          </Typography>
          <Stack spacing={1}>
            {Object.entries(store.openingHours).map(([day, hours]) => (
              <Box
                key={day}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                  {day}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {hours.closed ? (
                    'Closed'
                  ) : (
                    `${hours.open} - ${hours.close}`
                  )}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Grid>

        {/* Active Deals */}
        {deals.length > 0 && (
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Current Deals
            </Typography>
            <Stack spacing={2}>
              {deals.map((deal) => (
                <Paper
                  key={deal._id.toString()}
                  variant="outlined"
                  sx={{ p: 2 }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <DealIcon color="error" />
                      <Typography variant="subtitle2">
                        {deal.title}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {deal.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Valid until {new Date(deal.endDate).toLocaleDateString()}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Grid>
        )}

        {/* Store Features */}
        {store.features && store.features.length > 0 && (
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Store Features
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {store.features.map((feature) => (
                <Chip
                  key={feature}
                  label={feature}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Box>
          </Grid>
        )}
      </Grid>
    </Paper>
  );
}; 