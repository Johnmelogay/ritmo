FROM node:22-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy root dependencies and install them (zod, etc.)
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

# Copy app source & whatsapp daemon
COPY src/ ./src/
COPY whatsapp/package*.json ./whatsapp/
COPY whatsapp/tsconfig.json ./whatsapp/
COPY whatsapp/src/ ./whatsapp/src/

WORKDIR /app/whatsapp
RUN npm install --omit=dev

# Mount point for persistent WhatsApp credentials
RUN mkdir -p /app/whatsapp/auth_info
VOLUME ["/app/whatsapp/auth_info"]

ENV NODE_ENV=production
ENV NODE_PATH="/app/whatsapp/node_modules:/app/node_modules"
ENV PORT=8080

EXPOSE 8080

CMD ["npx", "tsx", "src/index.ts"]
