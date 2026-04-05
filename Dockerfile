FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python3-setuptools \
    build-essential \
    && pip3 install -q yt-dlp --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --include=optional
COPY . .

# Verify deps
RUN yt-dlp --version && node -e "require('tweetnacl'); require('@distube/soundcloud'); console.log('deps OK')"

CMD ["node", "--dns-result-order=ipv4first", "src/index.js"]
