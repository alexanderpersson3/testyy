import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import googleMapsService from '../services/google-maps.js';
import rateLimiter from '../middleware/rate-limit.js';

const router = express.Router();

// Validation schemas
const geocodeSchema = z.object({
  address: z.string().min(1)
});

const reverseGeocodeSchema = z.object({
  lat: z.number(),
  lng: z.number()
});

const nearbyStoresSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radius: z.number().optional()
});

const distanceSchema = z.object({
  origins: z.array(z.string()),
  destinations: z.array(z.string())
});

const directionsSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  waypoints: z.array(z.string()).optional()
});

const autocompleteSchema = z.object({
  input: z.string().min(1),
  sessionToken: z.string()
});

// Geocode address
router.post(
  '/geocode',
  rateLimiter.api(),
  validateRequest({ body: geocodeSchema }),
  async (req, res) => {
    try {
      const result = await googleMapsService.geocode(req.body.address);
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'No results found'
        });
      }
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('Geocoding error:', err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// Reverse geocode coordinates
router.post(
  '/reverse-geocode',
  rateLimiter.api(),
  validateRequest({ body: reverseGeocodeSchema }),
  async (req, res) => {
    try {
      const { lat, lng } = req.body;
      const result = await googleMapsService.reverseGeocode(lat, lng);
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'No results found'
        });
      }
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('Reverse geocoding error:', err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// Search nearby stores
router.post(
  '/nearby-stores',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: nearbyStoresSchema }),
  async (req, res) => {
    try {
      const { lat, lng, radius } = req.body;
      const stores = await googleMapsService.searchNearbyStores(lat, lng, radius);
      res.json({ success: true, data: stores });
    } catch (err) {
      console.error('Nearby stores search error:', err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// Get place details
router.get(
  '/places/:placeId',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const details = await googleMapsService.getPlaceDetails(req.params.placeId);
      res.json({ success: true, data: details });
    } catch (err) {
      console.error('Place details error:', err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// Calculate distances
router.post(
  '/distance',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: distanceSchema }),
  async (req, res) => {
    try {
      const { origins, destinations } = req.body;
      const distances = await googleMapsService.calculateDistance(origins, destinations);
      res.json({ success: true, data: distances });
    } catch (err) {
      console.error('Distance calculation error:', err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// Get directions
router.post(
  '/directions',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: directionsSchema }),
  async (req, res) => {
    try {
      const { origin, destination, waypoints } = req.body;
      const route = await googleMapsService.getDirections(origin, destination, waypoints);
      res.json({ success: true, data: route });
    } catch (err) {
      console.error('Directions error:', err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

// Address autocomplete
router.post(
  '/autocomplete',
  rateLimiter.api(),
  validateRequest({ body: autocompleteSchema }),
  async (req, res) => {
    try {
      const { input, sessionToken } = req.body;
      const predictions = await googleMapsService.autocompleteAddress(input, sessionToken);
      res.json({ success: true, data: predictions });
    } catch (err) {
      console.error('Autocomplete error:', err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
);

export default router; 