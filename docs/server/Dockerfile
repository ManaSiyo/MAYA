# MAYA API — Cloud Run container
FROM node:20-slim
WORKDIR /app
ARG MAYA_BUILD_COMMIT=local
RUN node -e "const commit=process.argv[1];if(!/^(local|[0-9a-f]{40})$/.test(commit))process.exit(1);require('fs').writeFileSync('build-info.json',JSON.stringify({commit}))" "$MAYA_BUILD_COMMIT"
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.js ./
COPY build-info.mjs lead-store.mjs ./
COPY model-config.mjs ./
COPY outbound.mjs ./
COPY crm-store.mjs crm-gmail.mjs crm-ai.mjs crm-intelligence.mjs ./
COPY owner-crm.mjs owner-conversation.mjs owner-sms-access.mjs message-archive.mjs ./
COPY booking-link.mjs lead-alerts.mjs text-automations.mjs event-triggers.mjs ./
COPY proxy-policy.mjs ./
COPY admin-command.mjs ./
COPY fabric-sourcing.js ./
COPY fabric-search.mjs ./
COPY ai-router.js ./
COPY design-config.mjs ./
COPY maya-mcp.mjs ./
COPY maya-phone.mjs ./
COPY maya-messages.mjs ./
COPY maya-feedback.mjs ./
COPY maya-transfer.mjs ./
COPY maya-character.md ./
EXPOSE 8080
CMD ["node", "server.js"]
