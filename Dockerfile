FROM node:22-alpine
WORKDIR /app
COPY project/package.json project/package-lock.json ./
RUN npm ci
COPY project/ ./
RUN npm run build
ENV NODE_ENV=production
RUN npm prune --omit=dev
CMD ["node", "server/index.js"]
