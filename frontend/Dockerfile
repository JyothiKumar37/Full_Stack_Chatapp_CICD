FROM node:22-alpine AS builder

WORKDIR /app

# Install all dependencies (dev deps are needed to build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Serve the static build with Nginx (this is the image that ships)
FROM nginx:stable-alpine

# Patch OS packages (openssl, etc.) in the SHIPPED image
RUN apk upgrade --no-cache

# Remove the default Nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the built assets and custom Nginx config
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

