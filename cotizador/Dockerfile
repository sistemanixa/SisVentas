FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.js ./

ENV NODE_ENV=production
CMD ["npm", "start"]
