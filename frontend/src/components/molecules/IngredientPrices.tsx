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
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stack,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Notifications,
  NotificationsOff,
  Store as StoreIcon,
  Map as MapIcon,
} from '@mui/icons-material';
import { priceService, PriceComparison, PriceAlert } from '../../services/price.service';
import { LineChart } from '@mui/x-charts/LineChart';
import { formatDistance } from 'date-fns';

interface IngredientPricesProps {
  ingredients: Array<{
    productId: string;
    name: string;
    amount: number;
    unit: string;
  }>;
  servings: number;
  onStoreSelect?: (storeId: string) => void;
}

const IngredientPrices: React.FC<IngredientPricesProps> = ({
  ingredients,
  servings,
  onStoreSelect,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [priceData, setPriceData] = useState<Record<string, PriceComparison>>({});
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [newAlert, setNewAlert] = useState({
    targetPrice: 0,
    currency: 'USD',
    notifyAbove: false,
    notifyBelow: true,
  });

  useEffect(() => {
    fetchPriceData();
    fetchAlerts();
  }, [ingredients]);

  const fetchPriceData = async () => {
    try {
      setLoading(true);
      const pricePromises = ingredients.map(ingredient =>
        priceService.getProductPrices(ingredient.productId)
      );
      const results = await Promise.all(pricePromises);
      
      const priceMap = ingredients.reduce((acc, ingredient, index) => {
        acc[ingredient.productId] = results[index];
        return acc;
      }, {} as Record<string, PriceComparison>);

      setPriceData(priceMap);
    } catch (err) {
      setError('Failed to fetch price data');
      console.error('Error fetching price data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const productIds = ingredients.map(i => i.productId);
      const alertsData = await priceService.getPriceAlerts({ active: true });
      setAlerts(alertsData.filter(alert => productIds.includes(alert.productId.toString())));
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const handleCreateAlert = async () => {
    if (!selectedIngredient) return;

    try {
      await priceService.createPriceAlert(selectedIngredient, newAlert);
      await fetchAlerts();
      setAlertDialogOpen(false);
    } catch (err) {
      console.error('Error creating alert:', err);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      await priceService.deletePriceAlert(alertId);
      await fetchAlerts();
    } catch (err) {
      console.error('Error deleting alert:', err);
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp color="error" />;
      case 'down':
        return <TrendingDown color="success" />;
      default:
        return <TrendingFlat color="action" />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
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
    <Box>
      <Typography variant="h6" gutterBottom>
        Price Comparison
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ingredient</TableCell>
              <TableCell align="right">Best Price</TableCell>
              <TableCell align="right">Average Price</TableCell>
              <TableCell align="right">Trend</TableCell>
              <TableCell>Best Store</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ingredients.map((ingredient) => {
              const priceInfo = priceData[ingredient.productId];
              if (!priceInfo) return null;

              const prices = priceInfo.prices.map(p => p.currentPrice);
              const bestPrice = Math.min(...prices);
              const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
              const bestStore = priceInfo.prices.find(p => p.currentPrice === bestPrice);
              const trend = bestPrice < avgPrice ? 'down' : bestPrice > avgPrice ? 'up' : 'stable';
              const alert = alerts.find(a => a.productId.toString() === ingredient.productId);

              return (
                <TableRow key={ingredient.productId}>
                  <TableCell>{ingredient.name}</TableCell>
                  <TableCell align="right">
                    ${(bestPrice * ingredient.amount / servings).toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    ${(avgPrice * ingredient.amount / servings).toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    {getTrendIcon(trend)}
                  </TableCell>
                  <TableCell>
                    {bestStore && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <StoreIcon fontSize="small" />
                        <Typography variant="body2">
                          {bestStore.store.name}
                        </Typography>
                        {onStoreSelect && (
                          <IconButton
                            size="small"
                            onClick={() => onStoreSelect(bestStore.store._id.toString())}
                          >
                            <MapIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={alert ? 'Remove price alert' : 'Set price alert'}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (alert) {
                            handleDeleteAlert(alert._id.toString());
                          } else {
                            setSelectedIngredient(ingredient.productId);
                            setAlertDialogOpen(true);
                          }
                        }}
                      >
                        {alert ? <NotificationsOff /> : <Notifications />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Price Alert Dialog */}
      <Dialog open={alertDialogOpen} onClose={() => setAlertDialogOpen(false)}>
        <DialogTitle>Set Price Alert</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Target Price"
              type="number"
              value={newAlert.targetPrice}
              onChange={(e) => setNewAlert(prev => ({
                ...prev,
                targetPrice: parseFloat(e.target.value),
              }))}
              InputProps={{
                startAdornment: '$',
              }}
            />
            <TextField
              select
              label="Currency"
              value={newAlert.currency}
              onChange={(e) => setNewAlert(prev => ({
                ...prev,
                currency: e.target.value,
              }))}
            >
              <MenuItem value="USD">USD</MenuItem>
              <MenuItem value="EUR">EUR</MenuItem>
              <MenuItem value="GBP">GBP</MenuItem>
            </TextField>
            <Stack direction="row" spacing={2}>
              <Button
                variant={newAlert.notifyBelow ? 'contained' : 'outlined'}
                onClick={() => setNewAlert(prev => ({
                  ...prev,
                  notifyBelow: !prev.notifyBelow,
                }))}
              >
                Notify Below
              </Button>
              <Button
                variant={newAlert.notifyAbove ? 'contained' : 'outlined'}
                onClick={() => setNewAlert(prev => ({
                  ...prev,
                  notifyAbove: !prev.notifyAbove,
                }))}
              >
                Notify Above
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateAlert} variant="contained">
            Create Alert
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IngredientPrices; 