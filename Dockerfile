# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (if any)
# This project uses only built-in modules, so npm install is optional
# but we'll keep it for consistency
RUN npm ci --only=production || true

# Copy application files
COPY . .

# Expose port (if running API server)
EXPOSE 3000

# Default command - can be overridden in docker-compose
CMD ["node", "test-client.js"]

