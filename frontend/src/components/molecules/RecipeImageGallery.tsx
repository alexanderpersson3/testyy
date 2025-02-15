import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Paper,
  ImageList,
  ImageListItem,
} from '@mui/material';
import {
  NavigateBefore,
  NavigateNext,
} from '@mui/icons-material';

interface RecipeImageGalleryProps {
  images: string[];
}

const RecipeImageGallery: React.FC<RecipeImageGalleryProps> = ({ images }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!images.length) {
    return (
      <Paper
        sx={{
          width: '100%',
          height: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.100',
        }}
      >
        No images available
      </Paper>
    );
  }

  const handlePrevious = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <Box sx={{ width: '100%', position: 'relative' }}>
      {/* Main Image */}
      <Paper
        sx={{
          width: '100%',
          height: 400,
          position: 'relative',
          overflow: 'hidden',
          mb: 2,
        }}
      >
        <Box
          component="img"
          src={images[currentImageIndex]}
          alt={`Recipe image ${currentImageIndex + 1}`}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        {images.length > 1 && (
          <>
            <IconButton
              onClick={handlePrevious}
              sx={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255, 255, 255, 0.8)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                },
              }}
            >
              <NavigateBefore />
            </IconButton>
            <IconButton
              onClick={handleNext}
              sx={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255, 255, 255, 0.8)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                },
              }}
            >
              <NavigateNext />
            </IconButton>
          </>
        )}
      </Paper>

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <ImageList
          sx={{
            width: '100%',
            height: 100,
            display: 'flex',
            overflowX: 'auto',
            m: 0,
          }}
          rowHeight={100}
          cols={images.length}
          gap={8}
        >
          {images.map((image, index) => (
            <ImageListItem
              key={index}
              onClick={() => setCurrentImageIndex(index)}
              sx={{
                cursor: 'pointer',
                opacity: index === currentImageIndex ? 1 : 0.6,
                transition: 'opacity 0.2s',
                '&:hover': {
                  opacity: 1,
                },
              }}
            >
              <img
                src={image}
                alt={`Thumbnail ${index + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </ImageListItem>
          ))}
        </ImageList>
      )}
    </Box>
  );
};

export default RecipeImageGallery; 