# MAYA API build recipe. Cloud Build reads this on every GitHub push and
# automatically deploys the server (docs/server) to Cloud Run. Do not move.
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY docs/server/package.json ./
RUN npm install --omit=dev
COPY docs/server/server.js ./
EXPOSE 8080
CMD ["node", "server.js"]
