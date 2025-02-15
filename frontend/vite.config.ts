import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'process.env': {
      REACT_APP_API_URL: JSON.stringify(process.env.REACT_APP_API_URL),
    },
  },
});