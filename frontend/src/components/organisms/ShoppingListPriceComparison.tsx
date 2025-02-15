import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
  TableSortLabel,
  TextField,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  DirectionsCar as DirectionsIcon,
  LocalOffer as PriceIcon,
  CheckCircle as InStockIcon,
  Cancel as OutOfStockIcon,
  ShoppingCart as CartIcon,
  TrendingUp as TrendingUpIcon,
  Savings as SavingsIcon,
  Store as StoreIcon,
  Info as InfoIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
} from '@mui/icons-material';
import { shoppingListService } from '../../services/shopping-list.service';
import { formatDistance } from '../../utils/format';
import { ObjectId } from 'mongodb';
import { LineChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Line, ResponsiveContainer } from 'recharts';

interface ShoppingListPriceComparisonProps {
  listId: string;
  userLocation?: { lat: number; lng: number };
  onStoreSelect?: (storeId: string) => void;
  maxDistance?: number;
}

type SortField = 'distance' | 'price' | 'availability';
type SortOrder = 'asc' | 'desc';

interface StoreComparison {
  store: {
    _id: ObjectId;
    name: string;
    distance: number;
  };
  totalPrice: number;
  currency: string;
  items: Array<{
    productId: string;
    price: number;
    inStock: boolean;
  }>;
}

interface PriceHistoryData {
  date: string;
  price: number;
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
}

export const ShoppingListPriceComparison: React.FC<ShoppingListPriceComparisonProps> = ({
  listId,
  userLocation,
  onStoreSelect,
  maxDistance = 10000,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceComparison, setPriceComparison] = useState<{
    stores: StoreComparison[];
  } | null>(null);

  // Sorting and filtering states
  const [sortField, setSortField] = useState<SortField>('price');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [nameFilter, setNameFilter] = useState('');
  const [maxDistanceFilter, setMaxDistanceFilter] = useState(maxDistance);
  const [minAvailability, setMinAvailability] = useState(0);

  // Statistics
  const [stats, setStats] = useState<{
    averagePrice: number;
    lowestPrice: number;
    highestPrice: number;
    averageAvailability: number;
    averageDistance: number;
    potentialSavings: number;
  } | null>(null);

  const [selectedStore, setSelectedStore] = useState<StoreComparison | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryData[]>([]);
  const [itemSuggestions, setItemSuggestions] = useState<Array<{
    name: string;
    price: number;
    frequency: number;
    savings: number;
  }>>([]);

  useEffect(() => {
    if (userLocation) {
      fetchPriceComparison();
    }
  }, [listId, userLocation]);

  useEffect(() => {
    if (priceComparison) {
      calculateStats();
    }
  }, [priceComparison]);

  useEffect(() => {
    if (selectedStore) {
      fetchPriceHistory(selectedStore.store._id.toString());
      fetchItemSuggestions(selectedStore.store._id.toString());
    }
  }, [selectedStore]);

  const fetchPriceComparison = async () => {
    if (!userLocation) return;

    try {
      setLoading(true);
      setError(null);
      const data = await shoppingListService.getPriceComparison(listId, {
        maxDistance,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      });
      setPriceComparison(data);
    } catch (err) {
      setError('Failed to load price comparison');
      console.error('Error fetching price comparison:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    if (!priceComparison?.stores.length) return;

    const prices = priceComparison.stores.map(s => s.totalPrice);
    const availabilities = priceComparison.stores.map(s => 
      (s.items.filter(i => i.inStock).length / s.items.length) * 100
    );
    const distances = priceComparison.stores.map(s => s.store.distance);

    setStats({
      averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      lowestPrice: Math.min(...prices),
      highestPrice: Math.max(...prices),
      averageAvailability: availabilities.reduce((a, b) => a + b, 0) / availabilities.length,
      averageDistance: distances.reduce((a, b) => a + b, 0) / distances.length,
      potentialSavings: Math.max(...prices) - Math.min(...prices),
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortedAndFilteredStores = () => {
    if (!priceComparison) return [];

    return priceComparison.stores
      .filter(store => {
        const nameMatch = store.store.name.toLowerCase().includes(nameFilter.toLowerCase());
        const distanceMatch = store.store.distance <= maxDistanceFilter;
        const availabilityMatch = 
          (store.items.filter(i => i.inStock).length / store.items.length) * 100 >= minAvailability;
        return nameMatch && distanceMatch && availabilityMatch;
      })
      .sort((a, b) => {
        const multiplier = sortOrder === 'asc' ? 1 : -1;
        switch (sortField) {
          case 'distance':
            return (a.store.distance - b.store.distance) * multiplier;
          case 'price':
            return (a.totalPrice - b.totalPrice) * multiplier;
          case 'availability':
            const aAvail = a.items.filter(i => i.inStock).length / a.items.length;
            const bAvail = b.items.filter(i => i.inStock).length / b.items.length;
            return (aAvail - bAvail) * multiplier;
          default:
            return 0;
        }
      });
  };

  const fetchPriceHistory = async (storeId: string) => {
    try {
      // Simulate price history data (replace with actual API call)
      const history: PriceHistoryData[] = [];
      Array.from({ length: 30 }).forEach((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        const basePrice = selectedStore?.totalPrice || 100;
        const randomVariation = (Math.random() - 0.5) * 10;
        const price = basePrice + randomVariation;
        
        const prevPrice = i > 0 ? history[i-1]?.price : price;
        const percentChange = ((price - prevPrice) / prevPrice) * 100;
        
        history.push({
          date: date.toLocaleDateString(),
          price,
          trend: percentChange > 1 ? 'up' : percentChange < -1 ? 'down' : 'stable',
          percentChange,
        });
      });
      setPriceHistory(history);
    } catch (err) {
      console.error('Error fetching price history:', err);
    }
  };

  const fetchItemSuggestions = async (storeId: string) => {
    try {
      // Simulate item suggestions (replace with actual API call)
      const suggestions = [
        { name: 'Milk', price: 2.99, frequency: 0.8, savings: 0.50 },
        { name: 'Bread', price: 1.99, frequency: 0.7, savings: 0.30 },
        { name: 'Eggs', price: 3.49, frequency: 0.6, savings: 0.75 },
      ];
      setItemSuggestions(suggestions);
    } catch (err) {
      console.error('Error fetching item suggestions:', err);
    }
  };

  const handleStoreClick = (store: StoreComparison) => {
    setSelectedStore(store);
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

  if (!priceComparison) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Enable location services to see price comparisons
      </Alert>
    );
  }

  const sortedStores = getSortedAndFilteredStores();

  return (
    <Stack spacing={3}>
      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <SavingsIcon color="primary" />
                    <Typography variant="h6">Potential Savings</Typography>
                  </Stack>
                  <Typography variant="h4" color="primary">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: priceComparison.stores[0].currency,
                    }).format(stats.potentialSavings)}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TrendingUpIcon color="primary" />
                    <Typography variant="h6">Average Price</Typography>
                  </Stack>
                  <Typography variant="h4">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: priceComparison.stores[0].currency,
                    }).format(stats.averagePrice)}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <StoreIcon color="primary" />
                    <Typography variant="h6">Average Availability</Typography>
                  </Stack>
                  <Typography variant="h4">
                    {stats.averageAvailability.toFixed(1)}%
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper elevation={3} sx={{ p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search stores"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography gutterBottom>Maximum Distance</Typography>
            <Slider
              value={maxDistanceFilter}
              onChange={(_, value) => setMaxDistanceFilter(value as number)}
              min={1000}
              max={maxDistance}
              step={1000}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => formatDistance(value)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography gutterBottom>Minimum Availability</Typography>
            <Slider
              value={minAvailability}
              onChange={(_, value) => setMinAvailability(value as number)}
              min={0}
              max={100}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Results Table */}
      <Paper elevation={3}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Store</TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortField === 'distance'}
                    direction={sortField === 'distance' ? sortOrder : 'asc'}
                    onClick={() => handleSort('distance')}
                  >
                    Distance
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortField === 'price'}
                    direction={sortField === 'price' ? sortOrder : 'asc'}
                    onClick={() => handleSort('price')}
                  >
                    Total Price
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center">
                  <TableSortLabel
                    active={sortField === 'availability'}
                    direction={sortField === 'availability' ? sortOrder : 'asc'}
                    onClick={() => handleSort('availability')}
                  >
                    Availability
                  </TableSortLabel>
                </TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedStores.map((store) => {
                const inStockCount = store.items.filter(item => item.inStock).length;
                const totalItems = store.items.length;
                const availabilityPercentage = (inStockCount / totalItems) * 100;

                return (
                  <TableRow 
                    key={store.store._id.toString()}
                    onClick={() => handleStoreClick(store)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <TableCell>
                      <Typography variant="subtitle2">
                        {store.store.name}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatDistance(store.store.distance)}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                        <PriceIcon 
                          color={store.totalPrice === stats?.lowestPrice ? "success" : "primary"} 
                        />
                        <Typography>
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: store.currency,
                          }).format(store.totalPrice)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={`${inStockCount} of ${totalItems} items available`}>
                        <Box>
                          {availabilityPercentage === 100 ? (
                            <Chip
                              icon={<InStockIcon />}
                              label="All items available"
                              color="success"
                              size="small"
                            />
                          ) : availabilityPercentage === 0 ? (
                            <Chip
                              icon={<OutOfStockIcon />}
                              label="No items available"
                              color="error"
                              size="small"
                            />
                          ) : (
                            <Chip
                              icon={<InStockIcon />}
                              label={`${inStockCount}/${totalItems} available`}
                              color="warning"
                              size="small"
                            />
                          )}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Get directions">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStoreClick(store);
                            }}
                          >
                            <DirectionsIcon />
                          </IconButton>
                        </Tooltip>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<CartIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          Shop here
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {sortedStores.length === 0 && (
          <Box p={4}>
            <Typography color="text.secondary" align="center">
              No stores found matching your criteria
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Store Details Dialog */}
      <Dialog 
        open={!!selectedStore} 
        onClose={() => setSelectedStore(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">{selectedStore?.store.name}</Typography>
            <Chip
              icon={<DirectionsIcon />}
              label={formatDistance(selectedStore?.store.distance || 0)}
              size="small"
            />
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            {/* Price History Chart */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Price History
                </Typography>
                <Box sx={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <LineChart data={priceHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis 
                        domain={['auto', 'auto']}
                        tickFormatter={(value) => 
                          new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: selectedStore?.currency || 'USD',
                            minimumFractionDigits: 0,
                          }).format(value)
                        }
                      />
                      <RechartsTooltip 
                        labelFormatter={(value: number) => 
                          new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: selectedStore?.currency || 'USD',
                          }).format(value)
                        }
                      />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#2196f3"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>

            {/* Item Suggestions */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Suggested Items
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Based on your shopping history and current deals
                </Typography>
                <List>
                  {itemSuggestions.map((item, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <PriceIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.name}
                        secondary={`${Math.round(item.frequency * 100)}% of shoppers buy this`}
                      />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" color="success.main">
                          Save {
                            new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: selectedStore?.currency || 'USD',
                            }).format(item.savings)
                          }
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          Add to List
                        </Button>
                      </Stack>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedStore(null)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<DirectionsIcon />}
            onClick={(e) => {
              e.stopPropagation();
              if (selectedStore) {
                onStoreSelect?.(selectedStore.store._id.toString());
                setSelectedStore(null);
              }
            }}
          >
            Get Directions
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}; 