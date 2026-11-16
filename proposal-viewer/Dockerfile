# Build context MUST be the curated directory produced by the release preparer.
# It contains only this package/lock, Dockerfile, public/ and reviewed server/.
FROM node:22-bookworm-slim@sha256:47725aca53d3295ec2d3be8f62726599b3033cc262edc2c7e429909b3ac599fc
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY server/ ./server/
COPY public/ ./public/
ENV NODE_ENV=production
USER node
CMD ["node", "server/proposal-viewer/server.js"]
