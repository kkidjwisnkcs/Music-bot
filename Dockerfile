FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python3-setuptools \
    python3-wheel \
    curl \
    && pip3 install -q yt-dlp --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

# Verify yt-dlp is installed and working
RUN yt-dlp --version

WORKDIR /app
COPY package*.json ./
# ffmpeg-static is included as a bundled fallback in case system ffmpeg path
# is not properly exposed. Both will be available.
RUN npm install --include=optional

COPY . .

# Verify all critical runtime deps load correctly
RUN node -e "\
  require('tweetnacl');\
  require('@distube/soundcloud');\
  require('@distube/yt-dlp');\
  require('discord.js');\
  require('distube');\
  require('ffmpeg-static');\
  console.log('All deps OK');\
"

CMD ["node", "--dns-result-order=ipv4first", "src/index.js"]
