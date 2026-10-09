#stage1:build
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

#stage2:production
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++ libstdc++
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/uploads/images && chown -R node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]