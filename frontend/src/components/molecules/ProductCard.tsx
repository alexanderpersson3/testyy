import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
  IconButton,
} from '@mui/material';
import { AddShoppingCart as AddShoppingCartIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';

interface ProductCardProps {
  title: string;
  price: number;
  image: string;
  discount?: number;
  category: string;
  onAddToCart: () => void;
}

const ProductCard = ({ title, price, image, discount, category, onAddToCart }: ProductCardProps) => {
  const MotionCard = motion(Card);

  return (
    <MotionCard
      whileHover={{ y: -8 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {discount && (
        <Chip
          label={`-${discount}%`}
          color="primary"
          size="small"
          sx={{
            position: 'absolute',
            top: -10,
            right: -10,
            zIndex: 1,
            fontWeight: 'bold',
          }}
        />
      )}
      <CardMedia
        component="img"
        height="200"
        image={image}
        alt={title}
        sx={{
          objectFit: 'cover',
          transition: 'transform 0.3s ease-in-out',
          '&:hover': {
            transform: 'scale(1.05)',
          },
        }}
      />
      <CardContent sx={{ flexGrow: 1, pt: 2 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ fontSize: '0.75rem' }}
        >
          {category}
        </Typography>
        <Typography
          variant="h6"
          component="h3"
          sx={{
            fontWeight: 600,
            mb: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
            ${price.toFixed(2)}
          </Typography>
          {discount && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textDecoration: 'line-through' }}
            >
              ${(price / (1 - discount / 100)).toFixed(2)}
            </Typography>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <IconButton
            color="primary"
            onClick={onAddToCart}
            sx={{
              backgroundColor: 'primary.main',
              color: 'white',
              '&:hover': {
                backgroundColor: 'primary.dark',
                transform: 'scale(1.1)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            <AddShoppingCartIcon />
          </IconButton>
        </Box>
      </CardContent>
    </MotionCard>
  );
};

export default ProductCard; 