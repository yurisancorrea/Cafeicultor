FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive

# Instala Chromium + fontes
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto \
    fonts-noto-color-emoji \
    ca-certificates \
    --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Puppeteer usa o Chromium do sistema (não faz download separado)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js .

EXPOSE 3000
CMD ["node", "server.js"]
