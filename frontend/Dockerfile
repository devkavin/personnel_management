FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm install --global npm@11.6.2 \
    && npm ci --no-audit --no-fund

COPY index.html tsconfig*.json vite.config.ts eslint.config.js openapi.json ./
COPY src ./src
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
