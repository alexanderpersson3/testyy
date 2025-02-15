import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Button,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  useTheme,
  useMediaQuery,
  Box,
  Container,
} from '@mui/material';
import { Menu as MenuIcon, ShoppingCart as CartIcon, Add as AddIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);

const Navigation = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();

  const menuItems = [
    { text: 'Home', path: '/' },
    { text: 'Products', path: '/products' },
    { text: 'Recipes', path: '/recipes' },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const isRecipesPath = location.pathname.startsWith('/recipes');

  return (
    <AppBar position="sticky" color="inherit" elevation={0}>
      <Container maxWidth="lg">
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <MotionBox 
            component={Link}
            to="/"
            sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Box
              component="img"
              src="/logo.svg"
              alt="Rezepta"
              sx={{ height: 40 }}
            />
          </MotionBox>

          {isMobile ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {isRecipesPath && (
                <Button
                  component={Link}
                  to="/recipes/create"
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  size="small"
                >
                  Create
                </Button>
              )}
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
              >
                <MenuIcon />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {menuItems.map((item) => (
                <Button
                  key={item.path}
                  component={Link}
                  to={item.path}
                  color={location.pathname === item.path ? 'primary' : 'inherit'}
                  sx={{
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      width: location.pathname === item.path ? '100%' : '0%',
                      height: '2px',
                      bottom: 0,
                      left: 0,
                      backgroundColor: theme.palette.primary.main,
                      transition: 'width 0.3s ease-in-out',
                    },
                    '&:hover::after': {
                      width: '100%',
                    },
                  }}
                >
                  {item.text}
                </Button>
              ))}
              {isRecipesPath && (
                <Button
                  component={Link}
                  to="/recipes/create"
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                >
                  Create Recipe
                </Button>
              )}
              <IconButton
                color="primary"
                sx={{
                  ml: 2,
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'scale(1.1)' },
                }}
              >
                <CartIcon />
              </IconButton>
            </Box>
          )}
        </Toolbar>
      </Container>

      <Drawer
        variant="temporary"
        anchor="right"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
        }}
      >
        <List>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.path}
              component={Link}
              to={item.path}
              onClick={handleDrawerToggle}
              selected={location.pathname === item.path}
            >
              <ListItemText primary={item.text} />
            </ListItemButton>
          ))}
          {isRecipesPath && (
            <ListItemButton
              component={Link}
              to="/recipes/create"
              onClick={handleDrawerToggle}
              selected={location.pathname === '/recipes/create'}
            >
              <ListItemText primary="Create Recipe" />
            </ListItemButton>
          )}
        </List>
      </Drawer>
    </AppBar>
  );
};

export default Navigation;