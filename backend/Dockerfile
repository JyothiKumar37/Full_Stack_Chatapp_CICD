FROM node:22-alpine AS builder

WORKDIR /app

# Install only production dependencies using the lockfile
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Stage 2: Production runtime (this is the image that ships)
FROM node:22-alpine

WORKDIR /app

# Patch OS packages (openssl, zlib, musl...) in the SHIPPED image, and add wget for the health check
RUN apk upgrade --no-cache && apk add --no-cache wget

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy dependencies and source from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

USER appuser

# Health check hits the /health route exposed in src/index.js
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5001/health || exit 1

CMD ["npm", "start"]

