import { Client } from '@googlemaps/google-maps-services-js';

class GoogleMapsService {
  constructor() {
    this.client = new Client({});
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  async geocode(address) {
    try {
      const response = await this.client.geocode({
        params: {
          address,
          key: this.apiKey
        }
      });

      if (response.data.results.length === 0) {
        return null;
      }

      const location = response.data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
        formattedAddress: response.data.results[0].formatted_address,
        placeId: response.data.results[0].place_id
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error('Failed to geocode address');
    }
  }

  async reverseGeocode(lat, lng) {
    try {
      const response = await this.client.reverseGeocode({
        params: {
          latlng: { lat, lng },
          key: this.apiKey
        }
      });

      if (response.data.results.length === 0) {
        return null;
      }

      return {
        address: response.data.results[0].formatted_address,
        placeId: response.data.results[0].place_id,
        components: response.data.results[0].address_components
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw new Error('Failed to reverse geocode coordinates');
    }
  }

  async searchNearbyStores(lat, lng, radius = 5000) {
    try {
      const response = await this.client.placesNearby({
        params: {
          location: { lat, lng },
          radius,
          type: 'grocery_or_supermarket',
          key: this.apiKey
        }
      });

      return response.data.results.map(place => ({
        id: place.place_id,
        name: place.name,
        address: place.vicinity,
        location: place.geometry.location,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        openNow: place.opening_hours?.open_now
      }));
    } catch (error) {
      console.error('Places search error:', error);
      throw new Error('Failed to search nearby stores');
    }
  }

  async getPlaceDetails(placeId) {
    try {
      const response = await this.client.placeDetails({
        params: {
          place_id: placeId,
          fields: [
            'name',
            'formatted_address',
            'geometry',
            'opening_hours',
            'formatted_phone_number',
            'website',
            'rating',
            'reviews'
          ],
          key: this.apiKey
        }
      });

      return response.data.result;
    } catch (error) {
      console.error('Place details error:', error);
      throw new Error('Failed to get place details');
    }
  }

  async calculateDistance(origins, destinations) {
    try {
      const response = await this.client.distancematrix({
        params: {
          origins,
          destinations,
          mode: 'driving',
          key: this.apiKey
        }
      });

      return response.data.rows.map((row, i) => ({
        origin: origins[i],
        distances: row.elements.map((element, j) => ({
          destination: destinations[j],
          distance: element.distance,
          duration: element.duration
        }))
      }));
    } catch (error) {
      console.error('Distance matrix error:', error);
      throw new Error('Failed to calculate distances');
    }
  }

  async getDirections(origin, destination, waypoints = []) {
    try {
      const response = await this.client.directions({
        params: {
          origin,
          destination,
          waypoints,
          optimize: true,
          mode: 'driving',
          key: this.apiKey
        }
      });

      return response.data.routes[0];
    } catch (error) {
      console.error('Directions error:', error);
      throw new Error('Failed to get directions');
    }
  }

  async autocompleteAddress(input, sessionToken) {
    try {
      const response = await this.client.placeAutocomplete({
        params: {
          input,
          types: 'address',
          sessiontoken: sessionToken,
          key: this.apiKey
        }
      });

      return response.data.predictions.map(prediction => ({
        placeId: prediction.place_id,
        description: prediction.description,
        mainText: prediction.structured_formatting.main_text,
        secondaryText: prediction.structured_formatting.secondary_text
      }));
    } catch (error) {
      console.error('Place autocomplete error:', error);
      throw new Error('Failed to autocomplete address');
    }
  }
}

export default new GoogleMapsService(); 