import React from 'react';
import { Container, Typography, Box } from '@mui/material';

export const Products: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Products
        </Typography>
        <Typography variant="body1">
          This feature is coming soon. Stay tuned for updates!
        </Typography>
      </Box>
    </Container>
  );
}; 