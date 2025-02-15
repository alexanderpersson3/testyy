import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  DirectionsCar as DirectionsIcon,
  LocalOffer as PriceIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
} from '@mui/icons-material';
import { StoreProductWithStore, StoreWithDistance, mapService } from '../../services/map.service';
import { formatDistance } from '../../utils/format';

interface ProductAvailabilityMapProps {
  productId: string;
  onStoreSelect?: (storeId: string) => void;
  maxDistance?: number; // in meters
}

export const ProductAvailabilityMap: React.FC<ProductAvailabilityMapProps> = ({
  productId,
  onStoreSelect,
  maxDistance = 10000, // 10km default
}) => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [availability, setAvailability] = useState<StoreProductWithStore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get user's location on component mount
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (location) {
      fetchAvailability();
    }
  }, [location, productId]);

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

  const fetchAvailability = async () => {
    if (!location) return;

    try {
      setLoading(true);
      setError(null);
      const data = await mapService.getProductAvailability(productId, {
        latitude: location.lat,
        longitude: location.lng,
        maxDistance,
      });
      setAvailability(data);
    } catch (err) {
      setError('Failed to fetch product availability');
      console.error('Error fetching availability:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPriceTrend = (product: StoreProductWithStore) => {
    if (!product.priceHistory || product.priceHistory.length < 2) {
      return { icon: <TrendingFlatIcon />, color: 'default' as const };
    }

    const sortedHistory = [...product.priceHistory].sort((a, b) => 
      b.date.getTime() - a.date.getTime()
    );
    const currentPrice = sortedHistory[0].price;
    const previousPrice = sortedHistory[1].price;
    const priceDiff = currentPrice - previousPrice;
    const percentChange = (priceDiff / previousPrice) * 100;

    if (Math.abs(percentChange) < 1) {
      return { icon: <TrendingFlatIcon />, color: 'default' as const };
    }
    if (percentChange > 0) {
      return { icon: <TrendingUpIcon />, color: 'error' as const };
    }
    return { icon: <TrendingDownIcon />, color: 'success' as const };
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Paper elevation={3}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Store</TableCell>
              <TableCell>Distance</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Trend</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {availability.map((item) => {
              const trend = getPriceTrend(item);
              const storeWithDistance = item as unknown as { store: StoreWithDistance };
              return (
                <TableRow key={item._id.toString()}>
                  <TableCell>
                    <Typography variant="subtitle2">
                      {item.store.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.store.address.street}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {location && formatDistance(storeWithDistance.store.distance)}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <PriceIcon fontSize="small" />
                      <Typography>
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: item.currency,
                        }).format(item.price)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Price trend">
                      <IconButton size="small" color={trend.color}>
                        {trend.icon}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.inStock ? 'In Stock' : 'Out of Stock'}
                      color={item.inStock ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Get directions">
                      <IconButton
                        size="small"
                        onClick={() => onStoreSelect?.(item.store._id.toString())}
                      >
                        <DirectionsIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {availability.length === 0 && (
        <Box p={4}>
          <Typography color="text.secondary" align="center">
            No stores with this product found in your area.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}; 