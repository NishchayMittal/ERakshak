# Stage 1: Build the React application
FROM node:22-alpine AS build

WORKDIR /app

# Accept build-time environment variables for Vite
ARG VITE_API_URL=http://localhost:8000
ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_USE_MOCKS=false

# Set them as environment variables so Vite can read them during build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_USE_MOCKS=$VITE_USE_MOCKS

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy the build output
COPY --from=build /app/dist /usr/share/nginx/html

# Copy our custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]