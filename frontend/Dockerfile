FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --global npm@11.6.2 \
    && npm ci --no-audit --no-fund
COPY index.html tsconfig*.json vite.config.ts eslint.config.js ./
COPY src ./src
EXPOSE 5173
CMD ["npm", "run", "dev"]
