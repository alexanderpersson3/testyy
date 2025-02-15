# Use the official Node.js 20 image as a parent image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy the rest of your source code
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# Use a non-root user for security
USER node

# Command to run the application
CMD ["npm", "start"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:8080/health || exit 1 