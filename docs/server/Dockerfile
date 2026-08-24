# MAYA API — Cloud Run container
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY proxy-policy.mjs ./
COPY admin-command.mjs ./
COPY fabric-sourcing.js ./
COPY ai-router.js ./
EXPOSE 8080
CMD ["node", "server.js"]
