import React, { useState } from 'react';
import { Container, Typography, Box, Grid, Button, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  LocalShipping,
  Timer,
  Nature as EcoIcon,
  LocalOffer,
} from '@mui/icons-material';
import ProductCard from '../components/molecules/ProductCard';

const Home = () => {
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
    },
  };

  const featuredProducts = [
    {
      id: 1,
      title: 'Organic Avocados',
      price: 4.99,
      image: '/products/avocado.svg',
      category: 'Fruits',
      discount: 20,
    },
    {
      id: 2,
      title: 'Fresh Sourdough Bread',
      price: 6.99,
      image: '/products/bread.svg',
      category: 'Bakery',
    },
    {
      id: 3,
      title: 'Local Farm Eggs',
      price: 5.99,
      image: '/products/eggs.svg',
      category: 'Dairy & Eggs',
      discount: 15,
    },
  ];

  const features = [
    {
      icon: <LocalShipping />,
      title: 'Free Delivery',
      description: 'Free delivery on orders over $50',
    },
    {
      icon: <Timer />,
      title: 'Express Delivery',
      description: 'Get your groceries within 2 hours',
    },
    {
      icon: <EcoIcon />,
      title: 'Fresh & Organic',
      description: 'Hand-picked fresh items from local farms',
    },
    {
      icon: <LocalOffer />,
      title: 'Best Prices',
      description: 'Price match guarantee on all items',
    },
  ];

  const handleAddToCart = () => {
    setCartCount(prev => prev + 1);
  };

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          minHeight: '90vh',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
          pt: 8,
          pb: 12,
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div variants={itemVariants}>
                  <Typography
                    variant="h1"
                    sx={{
                      fontWeight: 700,
                      mb: 2,
                      background: 'linear-gradient(45deg, #00A651 30%, #33B873 90%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    Fresh Groceries,
                    <br />
                    Delivered Right
                  </Typography>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Typography
                    variant="h5"
                    color="text.secondary"
                    sx={{ mb: 4, fontWeight: 400 }}
                  >
                    Shop for fresh groceries from your favorite local stores and get
                    them delivered to your doorstep.
                  </Typography>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => navigate('/products')}
                    sx={{
                      mr: 2,
                      px: 4,
                      py: 1.5,
                      borderRadius: '30px',
                      fontSize: '1.1rem',
                    }}
                  >
                    Shop Now
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => navigate('/recipes')}
                    sx={{
                      px: 4,
                      py: 1.5,
                      borderRadius: '30px',
                      fontSize: '1.1rem',
                    }}
                  >
                    Browse Recipes
                  </Button>
                </motion.div>
              </motion.div>
            </Grid>

            <Grid item xs={12} md={6}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <Box
                  component="img"
                  src="/hero-image.svg"
                  alt="Fresh groceries"
                  sx={{
                    width: '100%',
                    height: 'auto',
                    maxWidth: 600,
                    filter: 'drop-shadow(0px 10px 20px rgba(0, 0, 0, 0.1))',
                  }}
                />
              </motion.div>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: 8, backgroundColor: 'background.default' }}>
        <Container maxWidth="lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Grid container spacing={4}>
              {features.map((feature, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <motion.div
                    whileHover={{ y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 3,
                        height: '100%',
                        textAlign: 'center',
                        backgroundColor: 'background.paper',
                        borderRadius: 2,
                        transition: 'box-shadow 0.3s ease-in-out',
                        '&:hover': {
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mb: 2,
                          color: 'primary.main',
                          '& > svg': {
                            fontSize: 40,
                          },
                        }}
                      >
                        {feature.icon}
                      </Box>
                      <Typography
                        variant="h6"
                        component="h3"
                        sx={{ mb: 1, fontWeight: 600 }}
                      >
                        {feature.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.6 }}
                      >
                        {feature.description}
                      </Typography>
                    </Paper>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </motion.div>
        </Container>
      </Box>

      {/* Featured Products Section */}
      <Box sx={{ py: 8, backgroundColor: 'background.paper' }}>
        <Container maxWidth="lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Typography
              variant="h2"
              textAlign="center"
              sx={{
                mb: 6,
                fontWeight: 700,
                background: 'linear-gradient(45deg, #00A651 30%, #33B873 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Featured Products
            </Typography>

            <Grid container spacing={4}>
              {featuredProducts.map((product) => (
                <Grid item xs={12} sm={6} md={4} key={product.id}>
                  <ProductCard
                    title={product.title}
                    price={product.price}
                    image={product.image}
                    category={product.category}
                    discount={product.discount}
                    onAddToCart={handleAddToCart}
                  />
                </Grid>
              ))}
            </Grid>

            <Box sx={{ textAlign: 'center', mt: 6 }}>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/products')}
                sx={{
                  px: 6,
                  py: 1.5,
                  borderRadius: '30px',
                  fontSize: '1.1rem',
                }}
              >
                View All Products
              </Button>
            </Box>
          </motion.div>
        </Container>
      </Box>
    </Box>
  );
};

export default Home; 