FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.js ./
COPY ficha-producto.js ./
COPY proveedor-automatico.js ./
COPY conversion-proveedor.js ./

ENV NODE_ENV=production
CMD ["npm", "start"]
