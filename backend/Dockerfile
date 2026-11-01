# Smart Storage System - backend API
# ffmpeg is installed for the media pipeline (fluent-ffmpeg); sharp ships prebuilt binaries.
FROM node:20-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads \
    LOG_FILE_PATH=/app/logs

EXPOSE 3000

# Apply pending migrations, then start the API. A migration failure is logged
# but does not block startup (the server degrades gracefully without Postgres).
CMD ["sh", "-c", "npm run migrate:latest || echo 'WARN: migrations failed'; exec node src/index.js"]
