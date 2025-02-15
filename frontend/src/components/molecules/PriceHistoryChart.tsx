import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  useTheme,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { StoreProductWithStore } from '../../services/map.service';

interface PriceHistoryChartProps {
  product: StoreProductWithStore;
  height?: number;
  showStats?: boolean;
}

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({
  product,
  height = 300,
  showStats = true,
}) => {
  const theme = useTheme();

  const chartData = useMemo(() => {
    return product.priceHistory
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => ({
        date: new Date(item.date).toLocaleDateString(),
        price: item.price,
      }));
  }, [product.priceHistory]);

  const stats = useMemo(() => {
    const prices = product.priceHistory.map(item => item.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const current = product.price;
    const percentChange = ((current - prices[0]) / prices[0]) * 100;

    return { min, max, avg, current, percentChange };
  }, [product.priceHistory, product.price]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: product.currency,
    }).format(value);
  };

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Price History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {product.store.name}
          </Typography>
        </Box>

        {showStats && (
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip
              label={`Current: ${formatPrice(stats.current)}`}
              color="primary"
            />
            <Chip
              label={`Min: ${formatPrice(stats.min)}`}
              variant="outlined"
              color={stats.current === stats.min ? 'success' : undefined}
            />
            <Chip
              label={`Max: ${formatPrice(stats.max)}`}
              variant="outlined"
              color={stats.current === stats.max ? 'error' : undefined}
            />
            <Chip
              label={`Avg: ${formatPrice(stats.avg)}`}
              variant="outlined"
            />
            <Chip
              label={`${stats.percentChange >= 0 ? '+' : ''}${stats.percentChange.toFixed(1)}%`}
              color={stats.percentChange > 0 ? 'error' : 'success'}
            />
          </Stack>
        )}

        <Box sx={{ width: '100%', height }}>
          <ResponsiveContainer>
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickMargin={10}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickMargin={10}
                tickFormatter={formatPrice}
                domain={['auto', 'auto']}
              />
              <Tooltip
                formatter={(value: number) => [formatPrice(value), 'Price']}
                labelStyle={{ color: theme.palette.text.primary }}
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              />
              <ReferenceLine
                y={stats.avg}
                stroke={theme.palette.text.secondary}
                strokeDasharray="3 3"
                label={{
                  value: 'Average',
                  position: 'right',
                  fill: theme.palette.text.secondary,
                }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke={theme.palette.primary.main}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Stack>
    </Paper>
  );
}; 