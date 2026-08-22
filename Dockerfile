# Build stage: needs devDependencies (typescript) to compile src/ -> dist/
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci && npm cache clean --force

COPY src ./src
RUN npm run build

# Runtime stage: production deps only + compiled output
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
# Internal health-check server only (GET / and /health); not published by compose.
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/firehose-bot.js"]
