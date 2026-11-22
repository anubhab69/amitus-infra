# Production Dockerfile for Real Estate & Construction Inventory Management
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy application files
COPY package.json server.js ./
COPY public ./public
COPY data ./data

# Ensure data directory exists and has persistent permissions
VOLUME ["/app/data"]

# Expose standard web port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Start server
CMD ["node", "server.js"]
