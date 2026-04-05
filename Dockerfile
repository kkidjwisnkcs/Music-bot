FROM node:20-slim

# Install system deps: ffmpeg for audio, python3+yt-dlp for extraction,
# build tools for any native npm packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python3-setuptools \
    build-essential \
    libsodium-dev \
    && pip3 install -q yt-dlp --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./

# Install with optional deps to get native sodium/opus if possible
RUN npm install --include=optional

COPY . .

# Verify yt-dlp is accessible
RUN which yt-dlp && yt-dlp --version

CMD ["node", "src/index.js"]
